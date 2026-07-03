package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.PropertyPerformanceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Scanner analytics DÉTERMINISTE (Phase A) : porte côté serveur les heuristiques
 * métier historiquement calculées dans le front ({@code computeBusinessAlerts} /
 * {@code computeRecommendations}), sur données réelles (occupation plafonnée, marge
 * avec coûts d'intervention réels).
 *
 * <p>Émet des suggestions ORG-scopées via {@link SupervisionSuggestionService} :
 * certaines sont <b>actionnables</b> (ex. {@code PRICE_DROP} → bouton « Appliquer »
 * de la carte HITL), d'autres informationnelles. Aucun coût token (contrairement au
 * scan LLM). Dédupliqué par intitulé → un scan répété ne spamme pas la file.</p>
 */
@Service
public class BusinessAnalyticsScanner {

    private static final Logger log = LoggerFactory.getLogger(BusinessAnalyticsScanner.class);

    /** En-dessous : occupation FUTURE jugée faible → proposition de baisse tarifaire. */
    private static final double OCCUPANCY_LOW_PCT = 55.0;
    /** Fenêtre AVANT sur laquelle on juge l'occupation et cherche un créneau libre. */
    private static final int FORWARD_WINDOW_DAYS = 90;
    /** En-dessous : marge nette jugée insuffisante → alerte informationnelle. */
    private static final double MARGIN_LOW_PCT = 50.0;
    /** Baisse tarifaire proposée (%). */
    private static final int PRICE_DROP_PERCENT = 12;
    /** Longueur max du créneau remisé (on ne brade pas un trimestre entier). */
    private static final int MAX_DISCOUNT_NIGHTS = 21;
    /** En-deçà, un trou n'est pas jugé assez significatif pour une remise. */
    private static final int MIN_GAP_NIGHTS = 2;

    /** Dates de la plage affichées à l'humain (ex. « 8 juil. »). */
    private static final DateTimeFormatter RANGE_FMT = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH);

    private final PropertyPerformanceService performanceService;
    private final SupervisionSuggestionService suggestionService;
    private final ReservationRepository reservationRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public BusinessAnalyticsScanner(PropertyPerformanceService performanceService,
                                    SupervisionSuggestionService suggestionService,
                                    ReservationRepository reservationRepository,
                                    ObjectMapper objectMapper,
                                    Clock clock) {
        this.performanceService = performanceService;
        this.suggestionService = suggestionService;
        this.reservationRepository = reservationRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Évalue les heuristiques d'un logement et émet les suggestions correspondantes.
     * Best-effort : toute erreur est absorbée (jamais sur le chemin critique d'un scan).
     */
    public void scanProperty(Long orgId, Long propertyId) {
        try {
            // Occupation À VENIR faible → baisse tarifaire CIBLÉE sur le prochain
            // créneau réellement libre (fenêtre forward = ce qu'une remise remplit).
            final double forwardOccupancy = performanceService.forwardOccupancyRate(propertyId, FORWARD_WINDOW_DAYS);
            if (forwardOccupancy < OCCUPANCY_LOW_PCT) {
                LocalDate[] gap = findNextAvailableGap(orgId, propertyId);
                if (gap != null) {
                    emitPriceDrop(orgId, propertyId, gap[0], gap[1], forwardOccupancy);
                }
            }

            // Marge nette insuffisante → alerte informationnelle (module Finance).
            // Rétrospective (90 j passés) : la marge est un indicateur historique.
            final PropertyPerformanceDto perf = performanceService.compute(propertyId);
            if (perf.revenue().signum() > 0 && perf.netMargin() < MARGIN_LOW_PCT) {
                suggestionService.recordActionable(
                        orgId, propertyId, "fin",
                        "Marge nette faible",
                        String.format("Marge nette de %d %% sur les 90 derniers jours (seuil 60 %%). "
                                + "Analyser les coûts d'intervention pour identifier des économies.",
                                Math.round(perf.netMargin())),
                        null, null, null, "warning");
            }
        } catch (Exception e) {
            log.debug("business analytics scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Premier créneau CONTIGU de nuits libres à venir (dans la fenêtre forward),
     * borné à {@link #MAX_DISCOUNT_NIGHTS}. {@code null} si le logement est réservé
     * sur tout l'horizon proche ou si le trou est trop court ({@link #MIN_GAP_NIGHTS}).
     *
     * <p>Disponibilité déduite des réservations non annulées (une nuit
     * {@code [checkIn, checkOut)} est occupée). Retourne {@code [from, toExclusif)}.</p>
     */
    private LocalDate[] findNextAvailableGap(Long orgId, Long propertyId) {
        final LocalDate start = LocalDate.now(clock).plusDays(1);
        final LocalDate horizon = start.plusDays(FORWARD_WINDOW_DAYS);

        final Set<LocalDate> booked = new HashSet<>();
        for (Reservation r : reservationRepository.findByPropertyId(propertyId, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            LocalDate from = r.getCheckIn().isBefore(start) ? start : r.getCheckIn();
            LocalDate to = r.getCheckOut().isBefore(horizon) ? r.getCheckOut() : horizon;
            for (LocalDate d = from; d.isBefore(to); d = d.plusDays(1)) {
                booked.add(d);
            }
        }

        // Première nuit libre.
        LocalDate gapStart = null;
        for (LocalDate d = start; d.isBefore(horizon); d = d.plusDays(1)) {
            if (!booked.contains(d)) {
                gapStart = d;
                break;
            }
        }
        if (gapStart == null) {
            return null; // logement complet sur l'horizon proche
        }
        // Extension du créneau contigu, borné.
        LocalDate gapEnd = gapStart; // exclusif
        while (gapEnd.isBefore(horizon)
                && !booked.contains(gapEnd)
                && ChronoUnit.DAYS.between(gapStart, gapEnd) < MAX_DISCOUNT_NIGHTS) {
            gapEnd = gapEnd.plusDays(1);
        }
        if (ChronoUnit.DAYS.between(gapStart, gapEnd) < MIN_GAP_NIGHTS) {
            return null; // trou trop court pour justifier une remise
        }
        return new LocalDate[]{gapStart, gapEnd};
    }

    private void emitPriceDrop(Long orgId, Long propertyId, LocalDate from, LocalDate toExclusive,
                               double forwardOccupancy) {
        final long nights = ChronoUnit.DAYS.between(from, toExclusive);
        final String params;
        try {
            params = objectMapper.writeValueAsString(Map.of(
                    "from", from.toString(),
                    "to", toExclusive.toString(),
                    "percent", PRICE_DROP_PERCENT));
        } catch (Exception e) {
            log.debug("price-drop params serialization failed property={}: {}", propertyId, e.getMessage());
            return;
        }
        // Titre STABLE (sans dates ni %) → dédup fiable ; la plage et le chiffre
        // (fluctuants) vont dans le motif.
        suggestionService.recordActionable(
                orgId, propertyId, "rev",
                String.format("Baisser le tarif de −%d %% sur le prochain créneau libre", PRICE_DROP_PERCENT),
                String.format("Nuits libres du %s au %s (%d nuit%s). Occupation de %d %% sur les %d prochains "
                                + "jours (seuil %d %%). Une baisse ciblée sur ce créneau peut le remplir.",
                        RANGE_FMT.format(from), RANGE_FMT.format(toExclusive.minusDays(1)),
                        nights, nights > 1 ? "s" : "",
                        Math.round(forwardOccupancy), FORWARD_WINDOW_DAYS, Math.round(OCCUPANCY_LOW_PCT)),
                SupervisionActionType.PRICE_DROP, params, null, "warning");
    }
}
