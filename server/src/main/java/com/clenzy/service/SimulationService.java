package com.clenzy.service;

import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyElasticityEstimate;
import com.clenzy.model.PropertyPricingConfig;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyElasticityEstimateRepository;
import com.clenzy.repository.PropertyPricingConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Simulations what-if pour les decisions strategiques pricing/blocage.
 *
 * <h3>Modele d'elasticite (limitation assumee)</h3>
 * Modele lineaire simple : {@code occupancy_new = occupancy_baseline * (1 - pctChange * elasticity)}.
 * Constante {@code elasticity = 0.5} (sensibilite moyenne hotelliere observee).
 * A enrichir plus tard avec un modele ML par segment de marche.
 *
 * <h3>Hypotheses cles</h3>
 * <ul>
 *   <li>Fenetre historique : 6 derniers mois (suffisant pour lisser la saisonnalite courte).</li>
 *   <li>Revenue mesure : {@code Reservation.totalPrice} hors annulees.</li>
 *   <li>Occupancy : nuits reservees / nuits potentielles (clamp 0..1).</li>
 *   <li>ADR : revenue / nuits reservees, fallback {@code Property.nightlyPrice}.</li>
 *   <li>Blocage : on extrapole l'occupancy de la meme periode l'annee precedente. Si pas
 *       d'historique → on retombe sur l'occupancy globale recente.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    /** Elasticite par defaut : 10% de baisse de prix → 5% de hausse occupation. */
    static final double DEFAULT_ELASTICITY = 0.5;
    /** Sample size minimum pour qu'une estimation empirique soit consideree fiable. */
    private static final int MIN_EMPIRICAL_SAMPLE = 3;
    private static final int HISTORICAL_WINDOW_MONTHS = 6;
    private static final String CANCELLED_STATUS = "cancelled";

    private final ReservationService reservationService;
    private final PropertyService propertyService;
    private final PropertyPricingConfigRepository pricingConfigRepository;
    private final PropertyElasticityEstimateRepository elasticityEstimateRepository;

    public SimulationService(ReservationService reservationService,
                              PropertyService propertyService,
                              PropertyPricingConfigRepository pricingConfigRepository,
                              PropertyElasticityEstimateRepository elasticityEstimateRepository) {
        this.reservationService = reservationService;
        this.propertyService = propertyService;
        this.pricingConfigRepository = pricingConfigRepository;
        this.elasticityEstimateRepository = elasticityEstimateRepository;
    }

    /**
     * Simule l'impact d'un changement de prix sur le revenue d'une propriete.
     *
     * @param keycloakId user du caller (pour le filtrage reservations)
     * @param propertyId propriete cible
     * @param pctChange  variation en pourcentage (-0.10 = baisse 10%, +0.15 = hausse 15%).
     *                   Clamp dans [-0.50, +0.50] pour eviter les extrapolations absurdes.
     * @param from       debut de la fenetre simulee (inclusive)
     * @param to         fin de la fenetre simulee (inclusive)
     */
    public PricingChangeResult simulatePricingChange(String keycloakId, Long propertyId,
                                                       double pctChange,
                                                       LocalDate from, LocalDate to) {
        if (propertyId == null) {
            throw new IllegalArgumentException("propertyId est requis");
        }
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("from/to invalides");
        }

        double clampedChange = Math.max(-0.50, Math.min(0.50, pctChange));

        PropertyDto property = propertyService.getById(propertyId);
        if (property == null) {
            throw new IllegalArgumentException("Propriete " + propertyId + " introuvable");
        }

        Historical hist = loadHistorical(keycloakId, propertyId);
        long simulationDays = ChronoUnit.DAYS.between(from, to) + 1; // inclusif
        if (simulationDays <= 0) simulationDays = 1;

        ElasticityResolution elasticity = resolveElasticity(propertyId);

        // Baseline : on projette la performance recente sur la fenetre cible
        double adr = hist.adr(property.nightlyPrice);
        double baselineOccupancy = hist.occupancyRate();
        long baselineNights = Math.round(baselineOccupancy * simulationDays);
        BigDecimal baselineRevenue = BigDecimal.valueOf(adr * baselineNights)
                .setScale(2, RoundingMode.HALF_UP);

        // Scenario : occupancy varie avec l'elasticite resolue, ADR varie avec le pctChange
        double newOccupancy = Math.max(0.0, Math.min(1.0,
                baselineOccupancy * (1.0 - clampedChange * elasticity.value())));
        double newAdr = adr * (1.0 + clampedChange);
        long scenarioNights = Math.round(newOccupancy * simulationDays);
        BigDecimal scenarioRevenue = BigDecimal.valueOf(newAdr * scenarioNights)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal deltaRevenue = scenarioRevenue.subtract(baselineRevenue);
        double deltaOccupancy = newOccupancy - baselineOccupancy;
        double pctRevenueChange = baselineRevenue.signum() == 0
                ? 0.0
                : deltaRevenue.doubleValue() / baselineRevenue.doubleValue();

        log.debug("simulatePricingChange propertyId={} pct={} elasticity={} ({}) : ADR {}→{} occ {}→{} rev {}→{}",
                propertyId, clampedChange, elasticity.value(), elasticity.source(),
                adr, newAdr, baselineOccupancy, newOccupancy, baselineRevenue, scenarioRevenue);

        Scenario baseline = new Scenario(adr, baselineOccupancy, baselineNights, baselineRevenue);
        Scenario scenario = new Scenario(newAdr, newOccupancy, scenarioNights, scenarioRevenue);

        return new PricingChangeResult(
                property.id, property.name, clampedChange,
                from, to, simulationDays,
                elasticity.value(), elasticity.source().label,
                baseline, scenario,
                deltaRevenue, deltaOccupancy, pctRevenueChange,
                recommendation(clampedChange, pctRevenueChange, deltaOccupancy));
    }

    /**
     * Resolution de l'elasticite a appliquer pour une propriete.
     * Ordre de priorite :
     * <ol>
     *   <li>Override manuel ({@link PropertyPricingConfig#getElasticityOverride()})</li>
     *   <li>Estimation empirique cachee ({@link PropertyElasticityEstimate}) si
     *       {@code sampleSize >= 3}</li>
     *   <li>{@link #DEFAULT_ELASTICITY}</li>
     * </ol>
     *
     * <p>Echec silencieux : si les repos cassent, on revient au default — la
     * simulation reste utilisable.</p>
     */
    ElasticityResolution resolveElasticity(Long propertyId) {
        try {
            Optional<PropertyPricingConfig> override = pricingConfigRepository.findByPropertyId(propertyId);
            if (override.isPresent() && override.get().getElasticityOverride() != null) {
                return new ElasticityResolution(override.get().getElasticityOverride(),
                        ElasticitySource.OVERRIDE);
            }
        } catch (Exception e) {
            log.debug("resolveElasticity: override lookup failed for {} : {}",
                    propertyId, e.getMessage());
        }
        try {
            Optional<PropertyElasticityEstimate> estimate =
                    elasticityEstimateRepository.findByPropertyId(propertyId);
            if (estimate.isPresent() && estimate.get().getSampleSize() >= MIN_EMPIRICAL_SAMPLE) {
                return new ElasticityResolution(estimate.get().getElasticityValue(),
                        ElasticitySource.EMPIRICAL);
            }
        } catch (Exception e) {
            log.debug("resolveElasticity: empirical lookup failed for {} : {}",
                    propertyId, e.getMessage());
        }
        return new ElasticityResolution(DEFAULT_ELASTICITY, ElasticitySource.DEFAULT);
    }

    /**
     * Simule la perte de revenue d'un blocage calendrier.
     *
     * <p>L'estimation s'appuie sur l'occupancy de la meme periode l'annee precedente
     * (si suffisamment de donnees) ou sur la moyenne 6 mois (fallback).</p>
     */
    public CalendarBlockResult simulateCalendarBlock(String keycloakId, Long propertyId,
                                                      LocalDate from, LocalDate to) {
        if (propertyId == null) {
            throw new IllegalArgumentException("propertyId est requis");
        }
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("from/to invalides");
        }
        PropertyDto property = propertyService.getById(propertyId);
        if (property == null) {
            throw new IllegalArgumentException("Propriete " + propertyId + " introuvable");
        }

        long blockedDays = ChronoUnit.DAYS.between(from, to) + 1;

        // Reference : memes dates annee precedente
        LocalDate yearAgoFrom = from.minusYears(1);
        LocalDate yearAgoTo = to.minusYears(1);
        Historical sameWindowYearAgo = loadWindow(keycloakId, propertyId, yearAgoFrom, yearAgoTo);

        double estimatedOccupancy;
        String reference;
        if (sameWindowYearAgo.reservations > 0) {
            estimatedOccupancy = sameWindowYearAgo.occupancyRate();
            reference = "meme periode annee precedente";
        } else {
            Historical recent = loadHistorical(keycloakId, propertyId);
            estimatedOccupancy = recent.occupancyRate();
            reference = "moyenne 6 derniers mois";
        }

        double adr = sameWindowYearAgo.adr(property.nightlyPrice);
        long expectedBookedNights = Math.round(estimatedOccupancy * blockedDays);
        BigDecimal lostRevenue = BigDecimal.valueOf(adr * expectedBookedNights)
                .setScale(2, RoundingMode.HALF_UP);

        List<String> alternatives = new ArrayList<>();
        if (blockedDays >= 7) {
            alternatives.add("Decaler la maintenance sur une semaine plus creuse pour reduire la perte");
        }
        if (estimatedOccupancy > 0.7) {
            alternatives.add("Bloquer uniquement les jours strictement necessaires plutot que toute la plage");
        }
        if (estimatedOccupancy < 0.3) {
            alternatives.add("Cette periode est deja creuse : le blocage a un impact limite, profite-en pour les travaux");
        }
        if (alternatives.isEmpty()) {
            alternatives.add("Verifier si certains jours peuvent rester disponibles en mode partiel");
        }

        return new CalendarBlockResult(
                property.id, property.name, from, to, blockedDays,
                estimatedOccupancy, adr, expectedBookedNights, lostRevenue,
                reference, alternatives);
    }

    // ─── Helpers historique ──────────────────────────────────────────────────

    private Historical loadHistorical(String keycloakId, Long propertyId) {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.minusMonths(HISTORICAL_WINDOW_MONTHS);
        return loadWindow(keycloakId, propertyId, windowFrom, today);
    }

    private Historical loadWindow(String keycloakId, Long propertyId,
                                    LocalDate from, LocalDate to) {
        List<Reservation> reservations;
        try {
            reservations = reservationService.getReservations(keycloakId,
                    List.of(propertyId), from, to);
        } catch (Exception e) {
            log.warn("loadWindow: reservations lookup failed for property {}: {}",
                    propertyId, e.getMessage());
            reservations = List.of();
        }

        Historical h = new Historical();
        h.windowDays = ChronoUnit.DAYS.between(from, to) + 1;
        if (h.windowDays <= 0) h.windowDays = 1;

        for (Reservation r : reservations) {
            if (CANCELLED_STATUS.equalsIgnoreCase(r.getStatus())) continue;
            long totalNights = nightsTotal(r.getCheckIn(), r.getCheckOut());
            long clampedNights = nightsClamped(r.getCheckIn(), r.getCheckOut(), from, to);
            if (clampedNights == 0) continue;
            h.reservations++;
            h.bookedNights += clampedNights;
            // Pro-rate le revenue avec les nuits clamps pour que ADR reste coherent
            // quand un sejour deborde de la fenetre historique.
            if (r.getTotalPrice() != null && totalNights > 0) {
                BigDecimal pricePerNight = r.getTotalPrice()
                        .divide(BigDecimal.valueOf(totalNights), 4, RoundingMode.HALF_UP);
                h.totalRevenue = h.totalRevenue.add(
                        pricePerNight.multiply(BigDecimal.valueOf(clampedNights)));
            }
        }
        return h;
    }

    private static long nightsTotal(LocalDate ci, LocalDate co) {
        if (ci == null || co == null || !ci.isBefore(co)) return 0;
        return ChronoUnit.DAYS.between(ci, co);
    }

    private static long nightsClamped(LocalDate ci, LocalDate co,
                                        LocalDate winFrom, LocalDate winTo) {
        if (ci == null || co == null) return 0;
        LocalDate start = ci.isBefore(winFrom) ? winFrom : ci;
        LocalDate end = co.isAfter(winTo.plusDays(1)) ? winTo.plusDays(1) : co;
        if (!start.isBefore(end)) return 0;
        return ChronoUnit.DAYS.between(start, end);
    }

    private String recommendation(double pctChange, double pctRevenueChange, double deltaOccupancy) {
        if (Math.abs(pctRevenueChange) < 0.02) {
            return "Impact revenue quasi-neutre. Garde la strategie actuelle ou teste une variation plus marquee.";
        }
        if (pctChange < 0 && pctRevenueChange > 0.05) {
            return "Baisse de prix benefique : +" + percent(pctRevenueChange)
                    + " de revenue grace a l'augmentation d'occupation. Recommande.";
        }
        if (pctChange < 0 && pctRevenueChange < -0.05) {
            return "La baisse de prix degrade le revenue net (-" + percent(-pctRevenueChange)
                    + "). L'elasticite ne compense pas la marge perdue. A eviter.";
        }
        if (pctChange > 0 && pctRevenueChange > 0.05) {
            return "Hausse de prix benefique : +" + percent(pctRevenueChange)
                    + " de revenue, l'occupancy reste suffisante (" + percent(deltaOccupancy) + " sur l'occupation).";
        }
        if (pctChange > 0 && pctRevenueChange < -0.05) {
            return "Hausse de prix non rentable : perte de " + percent(-pctRevenueChange)
                    + " de revenue, l'occupation chute trop. Trouve un palier moins agressif.";
        }
        return "Effet modere : compare avec la concurrence avant d'arbitrer.";
    }

    private static String percent(double ratio) {
        return Math.round(ratio * 100) + "%";
    }

    // ─── DTOs (records, exposes au tool) ────────────────────────────────────

    public record Scenario(double adr, double occupancyRate,
                            long bookedNights, BigDecimal revenue) {}

    public record PricingChangeResult(
            Long propertyId, String propertyName, double pctChange,
            LocalDate from, LocalDate to, long simulationDays,
            double elasticity, String elasticitySource,
            Scenario baseline, Scenario scenario,
            BigDecimal deltaRevenue, double deltaOccupancy, double pctRevenueChange,
            String recommendation
    ) {}

    /**
     * Indique d'ou vient l'elasticite appliquee — propage au caller pour
     * affichage et debug (le tool peut mentionner "estimee empiriquement
     * sur 12 mois" au LLM).
     */
    public enum ElasticitySource {
        OVERRIDE("override_manual"),
        EMPIRICAL("empirical_12mo"),
        DEFAULT("default");

        public final String label;
        ElasticitySource(String label) { this.label = label; }
    }

    /** Resultat de {@link #resolveElasticity(Long)}, package-private pour tests. */
    record ElasticityResolution(double value, ElasticitySource source) {}

    public record CalendarBlockResult(
            Long propertyId, String propertyName,
            LocalDate from, LocalDate to, long daysBlocked,
            double estimatedOccupancy, double adr,
            long expectedBookedNights, BigDecimal estimatedLostRevenue,
            String reference, List<String> alternativeSuggestions
    ) {}

    /** Agregat historique sur une fenetre, package-private pour faciliter les tests. */
    static final class Historical {
        long windowDays;
        int reservations;
        long bookedNights;
        BigDecimal totalRevenue = BigDecimal.ZERO;

        double occupancyRate() {
            if (windowDays <= 0) return 0.0;
            return Math.max(0.0, Math.min(1.0, (double) bookedNights / windowDays));
        }

        double adr(BigDecimal nightlyPriceFallback) {
            if (bookedNights > 0 && totalRevenue.signum() > 0) {
                return totalRevenue.divide(BigDecimal.valueOf(bookedNights),
                        2, RoundingMode.HALF_UP).doubleValue();
            }
            // Fallback : nightlyPrice de la propriete (jamais 0 pour eviter une simulation a zero)
            if (nightlyPriceFallback != null && nightlyPriceFallback.signum() > 0) {
                return nightlyPriceFallback.doubleValue();
            }
            return 100.0;
        }
    }
}
