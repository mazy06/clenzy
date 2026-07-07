package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PortfolioSnapshotDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
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

    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final SupervisionActivityService activityService;
    private final Clock clock;

    public SupervisionPortfolioService(PropertyRepository propertyRepository,
                                       SupervisionSuggestionRepository suggestionRepository,
                                       SupervisionActivityService activityService,
                                       Clock clock) {
        this.propertyRepository = propertyRepository;
        this.suggestionRepository = suggestionRepository;
        this.activityService = activityService;
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

        final List<PortfolioSnapshotDto.AgentRollup> agents = buildRollups(pending, names);
        final PortfolioSnapshotDto.DayMetrics metrics = new PortfolioSnapshotDto.DayMetrics(
                "—", (int) activityService.orgAutoActions(organizationId), pendingCards.size());

        return new PortfolioSnapshotDto("portfolio", properties.size(), true, DEFAULT_AUTONOMY, false,
                agents, pendingCards, feed, metrics);
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
                                                                Map<Long, String> names) {
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
                    agent, waiting ? "wait" : "veille", DEFAULT_AUTONOMY, countByProperty.size(), task, items));
        }
        return rollups;
    }
}
