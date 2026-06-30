package com.clenzy.service.agent.analytics;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.LocalEventsRegistry;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SimulationService;
import com.clenzy.service.SimulationService.PricingChangeResult;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Recommandation de prix CONTINUE par créneau (P0-1).
 *
 * <p>Repère, sur la fenêtre à venir, les créneaux qui sous-vendent (occupation
 * faible) ou sur-vendent (occupation élevée) à partir du calendrier RÉEL, propose
 * un ajustement de prix, puis le <b>valide via la simulation existante</b>
 * ({@link SimulationService#simulatePricingChange}) qui porte l'élasticité réelle
 * (override / estimation empirique / défaut). Toute proposition jugée
 * revenue-négative par la simulation est supprimée. Read-only, org-scopée.</p>
 *
 * <p>Sert le chat (« où ajuster mes prix ? ») ET les scans autonomes de la
 * constellation (suggestions « baisser/monter de X% sur ce créneau », mode suggest).</p>
 */
@Service
public class PricingRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(PricingRecommendationService.class);
    private static final int SEGMENT_DAYS = 7;
    private static final double LOW_OCCUPANCY = 0.40;
    private static final double VERY_LOW_OCCUPANCY = 0.20;
    private static final double HIGH_OCCUPANCY = 0.85;
    /** En-deçà, la simulation juge l'ajustement revenue-négatif → on supprime. */
    private static final double NEGATIVE_IMPACT_THRESHOLD = -0.02;

    private final CalendarEngine calendarEngine;
    private final PriceEngine priceEngine;
    private final SimulationService simulationService;
    private final PropertyRepository propertyRepository;
    private final LocalEventsRegistry localEventsRegistry;
    private final TenantContext tenantContext;
    private final Clock clock;

    public PricingRecommendationService(CalendarEngine calendarEngine,
                                        PriceEngine priceEngine,
                                        SimulationService simulationService,
                                        PropertyRepository propertyRepository,
                                        LocalEventsRegistry localEventsRegistry,
                                        TenantContext tenantContext,
                                        Clock clock) {
        this.calendarEngine = calendarEngine;
        this.priceEngine = priceEngine;
        this.simulationService = simulationService;
        this.propertyRepository = propertyRepository;
        this.localEventsRegistry = localEventsRegistry;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    /**
     * Une recommandation d'ajustement sur un créneau.
     *
     * @param from                  début du créneau
     * @param to                    fin du créneau (incluse)
     * @param freeNights            nuits libres
     * @param bookedNights          nuits réservées
     * @param occupancy             taux d'occupation [0..1]
     * @param currentAvgPrice       prix moyen/nuit courant (nullable)
     * @param suggestedDeltaPct     ajustement proposé (ex. -8, +8)
     * @param direction             DECREASE | INCREASE
     * @param reason                justification métier
     * @param simulatedRevenueImpactPct impact revenu simulé de ce delta% sur TOUTE la fenêtre
     *        d'analyse (élasticité réelle, ratio indépendant du créneau), 0 si inconnu
     */
    public record PriceRecommendation(
            LocalDate from,
            LocalDate to,
            int freeNights,
            int bookedNights,
            double occupancy,
            BigDecimal currentAvgPrice,
            int suggestedDeltaPct,
            String direction,
            String reason,
            double simulatedRevenueImpactPct,
            List<String> events) {}

    /** Recommande des ajustements pour {@code propertyId} sur {@code windowDays} jours (7..90). */
    public List<PriceRecommendation> recommend(Long propertyId, int windowDays, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        int window = Math.max(7, Math.min(windowDays, 90));
        LocalDate windowEnd = today.plusDays(window);
        LocalDate lastNight = windowEnd.minusDays(1);

        // Ownership (règle audit #3) AVANT tout accès prix/calendrier : findById contourne le filtre
        // Hibernate et le fallback nightlyPrice de PriceEngine n'est pas tenant-safe → sans ce guard,
        // un propertyId d'une autre org fuiterait son prix. propertyId vient de l'argument du tool (LLM).
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || !orgId.equals(property.getOrganizationId())) {
            return List.of();
        }
        String city = property.getCity();
        String country = property.getCountryCode();

        // Calendrier réel : null OU AVAILABLE = libre ; BOOKED = vendu ; BLOCKED/MAINTENANCE = hors-vente.
        Map<LocalDate, CalendarDayStatus> statusByDate = new HashMap<>();
        for (CalendarDay d : calendarEngine.getDays(propertyId, today, windowEnd, orgId)) {
            if (d.getDate() != null) {
                statusByDate.put(d.getDate(), d.getStatus());
            }
        }
        // Prix courant par nuit (resolvePriceRange : borne haute exclusive).
        Map<LocalDate, BigDecimal> priceByDate = priceEngine.resolvePriceRange(propertyId, today, windowEnd, orgId);

        // Validation simulation mise en cache par delta% (la simulation ne dépend pas du créneau).
        Map<Integer, Double> impactByDelta = new HashMap<>();

        List<PriceRecommendation> recs = new ArrayList<>();
        for (LocalDate segFrom = today; !segFrom.isAfter(lastNight); segFrom = segFrom.plusDays(SEGMENT_DAYS)) {
            LocalDate segTo = segFrom.plusDays(SEGMENT_DAYS - 1);
            if (segTo.isAfter(lastNight)) {
                segTo = lastNight;
            }

            int free = 0, booked = 0;
            BigDecimal priceSum = BigDecimal.ZERO;
            int priceCount = 0;
            for (LocalDate d = segFrom; !d.isAfter(segTo); d = d.plusDays(1)) {
                CalendarDayStatus s = statusByDate.get(d);
                if (s == null || s == CalendarDayStatus.AVAILABLE) {
                    free++;
                } else if (s == CalendarDayStatus.BOOKED) {
                    booked++;
                } // BLOCKED / MAINTENANCE : exclus du calcul d'occupation
                BigDecimal p = priceByDate.get(d);
                if (p != null) {
                    priceSum = priceSum.add(p);
                    priceCount++;
                }
            }

            int sellable = free + booked;
            if (sellable == 0) {
                continue; // créneau entièrement bloqué → rien à recommander
            }
            double occupancy = (double) booked / sellable;

            Integer deltaPct = null;
            String direction = null;
            String reason = null;
            if (occupancy < LOW_OCCUPANCY && free >= 2) {
                deltaPct = occupancy < VERY_LOW_OCCUPANCY ? -15 : -8;
                direction = "DECREASE";
                reason = "Occupation faible (" + pct(occupancy) + ", " + free + " nuits libres) sur le créneau";
            } else if (occupancy > HIGH_OCCUPANCY) {
                deltaPct = 8;
                direction = "INCREASE";
                reason = "Occupation élevée (" + pct(occupancy) + ") — marge de hausse";
            }
            if (deltaPct == null) {
                continue;
            }

            // Demand-aware : un événement local sur le créneau atténue une baisse
            // (la demande devrait monter) ou renforce une hausse.
            List<String> events = eventsFor(city, country, segFrom, segTo);
            if (!events.isEmpty()) {
                String evt = String.join(", ", events.size() > 2 ? events.subList(0, 2) : events);
                if ("DECREASE".equals(direction)) {
                    deltaPct = deltaPct / 2; // baisse atténuée
                    reason += " · événement détecté (" + evt + ") → baisse modérée, demande attendue";
                } else {
                    reason += " · soutenu par l'événement (" + evt + ")";
                }
            }

            // Validation par l'élasticité réelle : on supprime si la simulation est nettement négative.
            double impact = impactByDelta.computeIfAbsent(deltaPct,
                    dp -> simulateImpact(keycloakId, propertyId, dp, today, lastNight));
            if (impact <= NEGATIVE_IMPACT_THRESHOLD) {
                continue;
            }

            BigDecimal avgPrice = priceCount > 0
                    ? priceSum.divide(BigDecimal.valueOf(priceCount), 2, RoundingMode.HALF_UP)
                    : null;
            recs.add(new PriceRecommendation(segFrom, segTo, free, booked,
                    round2(occupancy), avgPrice, deltaPct, direction, reason, round4(impact), events));
        }
        return recs;
    }

    /** Titres des événements locaux sur le créneau (vide si ville inconnue / erreur). */
    private List<String> eventsFor(String city, String country, LocalDate from, LocalDate to) {
        if (city == null || city.isBlank()) {
            return List.of();
        }
        try {
            return localEventsRegistry.findByCityAndDateRange(city, country, from, to).stream()
                    .map(e -> e.title)
                    .filter(t -> t != null && !t.isBlank())
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Impact revenu simulé (pctRevenueChange) pour un delta% ; 0 si indisponible. */
    private double simulateImpact(String keycloakId, Long propertyId, int deltaPct,
                                  LocalDate from, LocalDate to) {
        try {
            PricingChangeResult r = simulationService.simulatePricingChange(
                    keycloakId, propertyId, deltaPct / 100.0, from, to);
            return r != null ? r.pctRevenueChange() : 0.0;
        } catch (Exception e) {
            log.debug("PricingRecommendationService: simulation indisponible (prop={}): {}",
                    propertyId, e.getMessage());
            return 0.0;
        }
    }

    private static String pct(double v) {
        return Math.round(v * 100) + "%";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double round4(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
