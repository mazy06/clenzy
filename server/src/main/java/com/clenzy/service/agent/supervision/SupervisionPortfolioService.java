package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PortfolioSnapshotDto;
import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.PropertyPerformanceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Agrège la supervision de TOUS les logements d'une organisation en un unique
 * {@link PortfolioSnapshotDto} (vue « portefeuille » de la constellation).
 *
 * <p>Anti N+1 : deux requêtes org-scopées (suggestions en attente + feed) plutôt
 * qu'un balayage par logement. L'agrégat par agent (com/rev/ops/fin/rep) est
 * construit en mémoire à partir des suggestions en attente groupées par module.</p>
 */
@Service
public class SupervisionPortfolioService {

    private static final int FEED_FETCH = 300;
    private static final int FEED_KEEP = 40;
    private static final String STATUS_PENDING = SupervisionSuggestion.STATUS_PENDING;
    /** Ordre stable des agents de la constellation. */
    private static final List<String> AGENTS = List.of("com", "rev", "ops", "fin", "rep");
    private static final String DEFAULT_AUTONOMY = "suggest";

    private static final Logger log = LoggerFactory.getLogger(SupervisionPortfolioService.class);

    /** Fenêtre rétrospective (jours) pour les KPI portefeuille — alignée sur la perf par logement. */
    private static final int ORG_WINDOW_DAYS = 90;
    /** Seuils org (miroir de /reports computeBusinessAlerts). */
    private static final double ORG_OCC_CRITICAL_PCT = 50.0;
    private static final double ORG_MARGIN_LOW_PCT = 50.0;
    private static final long ORG_GAP_NIGHTS_HIGH = 20L;

    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final SupervisionActivityService activityService;
    private final PropertyPerformanceService performanceService;
    private final Clock clock;

    public SupervisionPortfolioService(PropertyRepository propertyRepository,
                                       SupervisionSuggestionRepository suggestionRepository,
                                       SupervisionModuleSettingsRepository moduleSettingsRepository,
                                       SupervisionActivityService activityService,
                                       PropertyPerformanceService performanceService,
                                       Clock clock) {
        this.propertyRepository = propertyRepository;
        this.suggestionRepository = suggestionRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.activityService = activityService;
        this.performanceService = performanceService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PortfolioSnapshotDto getSnapshot(Long organizationId) {
        final List<Property> properties = propertyRepository.findByOrganizationId(organizationId);
        final Map<Long, String> names = properties.stream()
                .filter(p -> p.getId() != null)
                .collect(Collectors.toMap(Property::getId, this::propertyName, (a, b) -> a));

        final List<SupervisionSuggestion> pending = suggestionRepository
                .findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        organizationId, STATUS_PENDING, clock.instant());
        final List<PortfolioSnapshotDto.PendingCard> pendingCards = pending.stream()
                .map(s -> toPendingCard(s, names))
                .toList();

        final List<PortfolioSnapshotDto.FeedEntry> feed = activityService
                .recentOrgFeed(organizationId, FEED_FETCH, FEED_KEEP).stream()
                .map(a -> toFeedEntry(a, names))
                .toList();

        // Autonomie RÉELLE par agent (SupervisionModuleSettings, éditée via /config).
        final Map<String, String> autonomyByAgent = moduleSettingsRepository
                .findByOrganizationId(organizationId).stream()
                .filter(m -> m.getModuleKey() != null && m.getAutonomyLevel() != null)
                .collect(Collectors.toMap(SupervisionModuleSettings::getModuleKey,
                        m -> m.getAutonomyLevel().toWire(), (a, b) -> a));

        final List<PortfolioSnapshotDto.AgentRollup> agents = buildRollups(pending, names, autonomyByAgent);
        final PortfolioSnapshotDto.DayMetrics metrics = new PortfolioSnapshotDto.DayMetrics(
                "—", (int) activityService.orgAutoActions(organizationId), pendingCards.size());

        return new PortfolioSnapshotDto("portfolio", properties.size(), true,
                deriveGlobalAutonomy(autonomyByAgent), false, agents, pendingCards, feed, metrics,
                computeOrgAlerts(organizationId));
    }

    /**
     * Alertes de niveau PORTEFEUILLE (org) — indicateurs globaux qui ne se rattachent pas
     * à un logement unique : occupation moyenne, nuits vacantes cumulées, marge nette org.
     * Agrégées depuis les perfs par logement (fenêtre {@value #ORG_WINDOW_DAYS} j). Miroir
     * serveur de /reports {@code computeBusinessAlerts}, sans la baisse de revenus (qui
     * exigerait une période précédente — non calculée ici). Best-effort : liste vide si erreur.
     */
    private List<PortfolioSnapshotDto.OrgAlert> computeOrgAlerts(Long organizationId) {
        try {
            final List<PropertyPerformanceDto> perfs =
                    performanceService.computeSummaries(organizationId, ORG_WINDOW_DAYS);
            if (perfs.isEmpty()) {
                return List.of();
            }
            final int n = perfs.size();
            final double avgOccupancy = perfs.stream().mapToDouble(PropertyPerformanceDto::occupancyRate).sum() / n;
            // Nuits vacantes cumulées = Σ jours × (1 − occ/100).
            final long gapNights = Math.round(perfs.stream()
                    .mapToDouble(p -> p.windowDays() * (1.0 - p.occupancyRate() / 100.0)).sum());
            // Marge nette org pondérée par le revenu (les logements sans revenu ne pèsent pas).
            final double totalRevenue = perfs.stream()
                    .mapToDouble(p -> p.revenue() != null ? p.revenue().doubleValue() : 0.0).sum();
            final double weightedMargin = totalRevenue > 0 ? perfs.stream()
                    .mapToDouble(p -> p.netMargin() * (p.revenue() != null ? p.revenue().doubleValue() : 0.0)).sum()
                    / totalRevenue : 0.0;

            final List<PortfolioSnapshotDto.OrgAlert> alerts = new ArrayList<>(3);
            if (gapNights > ORG_GAP_NIGHTS_HIGH) {
                alerts.add(new PortfolioSnapshotDto.OrgAlert("critical", "Nuits vacantes élevées",
                        String.format("%d nuits vacantes cumulées sur le parc (%d j). Revoir la stratégie tarifaire.",
                                gapNights, ORG_WINDOW_DAYS)));
            }
            if (avgOccupancy < ORG_OCC_CRITICAL_PCT) {
                alerts.add(new PortfolioSnapshotDto.OrgAlert("critical", "Taux d'occupation critique",
                        String.format("Occupation moyenne de %d %% sur le parc (seuil recommandé : 60 %%). "
                                + "Envisager des promotions.", Math.round(avgOccupancy))));
            }
            if (totalRevenue > 0 && weightedMargin < ORG_MARGIN_LOW_PCT) {
                alerts.add(new PortfolioSnapshotDto.OrgAlert("warning", "Marge nette insuffisante",
                        String.format("Marge nette de %d %% sur le parc (objectif : 60 %%). Optimiser les coûts.",
                                Math.round(weightedMargin))));
            }
            return alerts;
        } catch (Exception e) {
            log.debug("org alerts computation failed org={}: {}", organizationId, e.getMessage());
            return List.of();
        }
    }

    /** Autonomie globale = valeur commune aux 5 agents si homogène, sinon la plus prudente (suggest). */
    private String deriveGlobalAutonomy(Map<String, String> autonomyByAgent) {
        final java.util.Set<String> levels = AGENTS.stream()
                .map(a -> autonomyByAgent.getOrDefault(a, DEFAULT_AUTONOMY))
                .collect(Collectors.toSet());
        return levels.size() == 1 ? levels.iterator().next() : DEFAULT_AUTONOMY;
    }

    private String propertyName(Property p) {
        return p.getName() != null && !p.getName().isBlank() ? p.getName() : ("Logement " + p.getId());
    }

    private String nameOf(Long propertyId, Map<Long, String> names) {
        return names.getOrDefault(propertyId, "Logement " + propertyId);
    }

    private PortfolioSnapshotDto.PendingCard toPendingCard(SupervisionSuggestion s, Map<Long, String> names) {
        final String motif = s.getMotif() != null ? s.getMotif() : "";
        final Double amountEur = s.getEstimatedImpactCents() != null
                ? s.getEstimatedImpactCents() / 100.0 : null;
        return new PortfolioSnapshotDto.PendingCard(
                String.valueOf(s.getId()),
                s.getModuleKey(),
                s.getTitle(),
                motif,
                motif,
                s.getReservationId() != null ? String.valueOf(s.getReservationId()) : null,
                s.getCreatedAt() != null ? s.getCreatedAt().toString() : null,
                s.getExpiresAt() != null ? s.getExpiresAt().toString() : null,
                s.getActionType(),
                amountEur,
                String.valueOf(s.getPropertyId()),
                nameOf(s.getPropertyId(), names));
    }

    private PortfolioSnapshotDto.FeedEntry toFeedEntry(SupervisionActivity a, Map<Long, String> names) {
        return new PortfolioSnapshotDto.FeedEntry(
                String.valueOf(a.getId()),
                a.getModuleKey(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : null,
                a.getSummary(),
                a.getToolName(),
                nameOf(a.getPropertyId(), names));
    }

    /** Un rollup par agent : statut wait si des suggestions l'attendent, ventilation par logement. */
    private List<PortfolioSnapshotDto.AgentRollup> buildRollups(List<SupervisionSuggestion> pending,
                                                                Map<Long, String> names,
                                                                Map<String, String> autonomyByAgent) {
        final Map<String, List<SupervisionSuggestion>> byModule = pending.stream()
                .filter(s -> s.getModuleKey() != null && s.getPropertyId() != null)
                .collect(Collectors.groupingBy(SupervisionSuggestion::getModuleKey));

        final List<PortfolioSnapshotDto.AgentRollup> rollups = new ArrayList<>(AGENTS.size());
        for (String agent : AGENTS) {
            final List<SupervisionSuggestion> forAgent = byModule.getOrDefault(agent, List.of());
            final Map<Long, Long> countByProperty = forAgent.stream()
                    .collect(Collectors.groupingBy(SupervisionSuggestion::getPropertyId, Collectors.counting()));
            final List<PortfolioSnapshotDto.AgentItem> items = countByProperty.entrySet().stream()
                    .map(e -> new PortfolioSnapshotDto.AgentItem(
                            String.valueOf(e.getKey()),
                            nameOf(e.getKey(), names),
                            "wait",
                            e.getValue() + " en attente"))
                    .toList();
            final boolean waiting = !forAgent.isEmpty();
            final String task = waiting ? forAgent.size() + " action(s) en attente" : "";
            rollups.add(new PortfolioSnapshotDto.AgentRollup(
                    agent, waiting ? "wait" : "veille",
                    autonomyByAgent.getOrDefault(agent, DEFAULT_AUTONOMY),
                    countByProperty.size(), task, items));
        }
        return rollups;
    }
}
