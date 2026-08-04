package com.clenzy.service.agent.supervision;

import com.clenzy.model.Intervention;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Règles de scan DÉTERMINISTES finance (agent Finance « fin », vague B), basées sur une
 * distinction temporelle honnête du même signal « intervention » :
 * <ul>
 *   <li><b>Incident SUBI PENDANT le séjour</b> (intervention créée entre check-in et
 *       check-out : le voyageur a vécu la panne) → carte {@code GOODWILL_REFUND}
 *       « Rembourser » — geste commercial proposé AVANT que l'avis ne tombe ;</li>
 *   <li><b>Dégât constaté AU DÉPART</b> (intervention à coût créée dans les 48 h après
 *       le check-out, caution encore HELD) → carte {@code DEPOSIT_WITHHOLD}
 *       « Retenir » — capture partielle bornée par la caution.</li>
 * </ul>
 *
 * <p>Montants indicatifs seulement : les handlers re-résolvent tout à l'apply (règle
 * audit n°1). Fenêtre de scan : départs des 3 derniers jours. Dédup par intitulé
 * (id de réservation). Best-effort par règle.</p>
 */
@Service
public class FinanceIncidentScanner {

    private static final Logger log = LoggerFactory.getLogger(FinanceIncidentScanner.class);
    private static final String MODULE_FIN = "fin";

    static final int CHECKOUT_LOOKBACK_DAYS = 3;
    static final int DAMAGE_WINDOW_HOURS = 48;
    static final int GESTURE_PERCENT = 15;

    private final ReservationRepository reservationRepository;
    private final SecurityDepositRepository securityDepositRepository;
    private final InterventionRepository interventionRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public FinanceIncidentScanner(ReservationRepository reservationRepository,
                                  SecurityDepositRepository securityDepositRepository,
                                  InterventionRepository interventionRepository,
                                  SupervisionSuggestionService suggestionService,
                                  Clock clock) {
        this.reservationRepository = reservationRepository;
        this.securityDepositRepository = securityDepositRepository;
        this.interventionRepository = interventionRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les deux règles pour un logement. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            final LocalDate today = LocalDate.now(clock);
            final List<Reservation> departed = reservationRepository.findRecentCheckoutsByPropertyId(
                    propertyId, today.minusDays(CHECKOUT_LOOKBACK_DAYS), today.plusDays(1), orgId);
            if (departed.isEmpty()) {
                return;
            }
            final Map<Long, SecurityDeposit> heldByReservation = securityDepositRepository
                    .findHeldByReservationIds(departed.stream().map(Reservation::getId).toList())
                    .stream().collect(Collectors.toMap(SecurityDeposit::getReservationId, d -> d));

            for (Reservation reservation : departed) {
                scanStayIncident(orgId, propertyId, reservation);
                final SecurityDeposit deposit = heldByReservation.get(reservation.getId());
                if (deposit != null) {
                    scanDepartureDamage(orgId, propertyId, reservation, deposit);
                }
            }
        } catch (Exception e) {
            log.debug("finance incident scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /** Incident pendant le séjour → geste commercial proposé (avant l'avis). */
    private void scanStayIncident(Long orgId, Long propertyId, Reservation reservation) {
        if (reservation.getCheckIn() == null || reservation.getCheckOut() == null
                || reservation.getTotalPrice() == null
                || reservation.getTotalPrice().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        final List<Intervention> duringStay = interventionRepository.findByPropertyAndCreatedBetween(
                propertyId, orgId,
                reservation.getCheckIn().atStartOfDay(),
                reservation.getCheckOut().atStartOfDay());
        final Intervention incident = duringStay.stream()
                .filter(i -> i.getType() != null && i.getType().contains("MAINTENANCE"))
                .findFirst().orElse(null);
        if (incident == null) {
            return;
        }
        final BigDecimal gesture = reservation.getTotalPrice()
                .multiply(BigDecimal.valueOf(GESTURE_PERCENT))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        suggestionService.recordActionableStrict(
                orgId, propertyId, MODULE_FIN, reservation.getId(),
                "Geste commercial après incident (réservation #" + reservation.getId() + ")",
                "Une panne a été traitée PENDANT le séjour (« " + incident.getTitle() + " »). "
                        + "Un avoir de " + GESTURE_PERCENT + " % proposé avant que le voyageur ne "
                        + "dépose son avis — « Rembourser » calcule et borne le montant côté serveur.",
                SupervisionActionType.GOODWILL_REFUND,
                "{\"reservationId\":" + reservation.getId() + ",\"percent\":" + GESTURE_PERCENT + "}",
                gesture.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact(),
                "info");
    }

    /** Dégât constaté au départ (caution encore HELD) → retenue proposée. */
    private void scanDepartureDamage(Long orgId, Long propertyId,
                                     Reservation reservation, SecurityDeposit deposit) {
        if (reservation.getCheckOut() == null) {
            return;
        }
        final List<Intervention> postCheckout = interventionRepository.findByPropertyAndCreatedBetween(
                propertyId, orgId,
                reservation.getCheckOut().atStartOfDay(),
                reservation.getCheckOut().atStartOfDay().plusHours(DAMAGE_WINDOW_HOURS));
        final Intervention damage = postCheckout.stream()
                .filter(i -> cost(i) != null && cost(i).compareTo(BigDecimal.ZERO) > 0)
                .findFirst().orElse(null);
        if (damage == null) {
            return;
        }
        final BigDecimal proposed = cost(damage).min(deposit.getAmount());
        suggestionService.recordActionableStrict(
                orgId, propertyId, MODULE_FIN, reservation.getId(),
                "Retenue de caution proposée (réservation #" + reservation.getId() + ")",
                "Un dégât a été signalé au départ (« " + damage.getTitle() + " », coût estimé "
                        + cost(damage) + " €) et la caution est encore pré-autorisée. « Retenir » "
                        + "capture le coût re-vérifié au moment du débit, borné par la caution ; "
                        + "le justificatif reste à adresser au voyageur.",
                SupervisionActionType.DEPOSIT_WITHHOLD,
                "{\"depositId\":" + deposit.getId() + ",\"interventionId\":" + damage.getId() + "}",
                proposed.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact(),
                "warning");
    }

    private static BigDecimal cost(Intervention intervention) {
        return intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
    }
}
