package com.clenzy.service.agent.supervision;

import com.clenzy.model.Intervention;
import com.clenzy.model.OwnerPayout;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Règles de scan DÉTERMINISTES relation propriétaire (agent Propriétaire « own »,
 * vague B) :
 * <ul>
 *   <li><b>Reversement en attente</b> : payout PENDING → carte {@code OWNER_PAYOUT}
 *       « Approuver » (le virement reste le flux bancaire existant) — ancrée sur le
 *       plus petit logement du propriétaire pour n'apparaître qu'une fois ;</li>
 *   <li><b>Accord travaux</b> : intervention maintenance récente à coût ≥
 *       {@value #WORKS_THRESHOLD_EUR} € encore PENDING → carte
 *       {@code OWNER_WORKS_APPROVAL} « Envoyer » (demande d'accord par email au
 *       propriétaire, photos et devis à joindre depuis la fiche intervention).</li>
 * </ul>
 *
 * <p>Zéro coût token. Dédup par intitulé (ids). Best-effort par règle.</p>
 */
@Service
public class OwnerRelationScanner {

    private static final Logger log = LoggerFactory.getLogger(OwnerRelationScanner.class);
    private static final String MODULE_OWN = "own";

    static final int WORKS_THRESHOLD_EUR = 300;
    static final int WORKS_LOOKBACK_DAYS = 14;
    /** Recul de revenus qui déclenche la note (≥ 30 % vs même mois N−1). */
    static final java.math.BigDecimal REVENUE_DROP_RATIO = new java.math.BigDecimal("0.70");
    /** La note ne se propose qu'en début de mois (le mois écoulé vient de se fermer). */
    static final int REVENUE_NOTE_WINDOW_DAYS = 7;

    private final OwnerPayoutRepository ownerPayoutRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final com.clenzy.repository.ReservationRepository reservationRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public OwnerRelationScanner(OwnerPayoutRepository ownerPayoutRepository,
                                InterventionRepository interventionRepository,
                                PropertyRepository propertyRepository,
                                com.clenzy.repository.ReservationRepository reservationRepository,
                                SupervisionSuggestionService suggestionService,
                                Clock clock) {
        this.ownerPayoutRepository = ownerPayoutRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les deux règles pour un logement. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanPendingPayouts(orgId, propertyId);
        } catch (Exception e) {
            log.debug("owner payout scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanWorksApproval(orgId, propertyId);
        } catch (Exception e) {
            log.debug("owner works scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanRevenueDrop(orgId, propertyId);
        } catch (Exception e) {
            log.debug("owner revenue scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * OWNER_REVENUE_NOTE (vague C) : le mois écoulé recule de ≥ 30 % vs le même mois
     * N−1 (approximation par mois d'arrivée) → carte « Envoyer » une note FACTUELLE
     * au propriétaire — devancer sa question plutôt que la subir. Proposée uniquement
     * les {@value #REVENUE_NOTE_WINDOW_DAYS} premiers jours du mois ; les montants de
     * la carte sont indicatifs, l'apply re-calcule tout (règle audit n°1).
     */
    private void scanRevenueDrop(Long orgId, Long propertyId) {
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        if (today.getDayOfMonth() > REVENUE_NOTE_WINDOW_DAYS) {
            return;
        }
        final java.time.YearMonth lastMonth = java.time.YearMonth.from(today).minusMonths(1);
        final java.math.BigDecimal current = reservationRepository.sumRevenueByPropertyAndCheckInBetween(
                propertyId, orgId, lastMonth.atDay(1), lastMonth.plusMonths(1).atDay(1));
        final java.math.BigDecimal previous = reservationRepository.sumRevenueByPropertyAndCheckInBetween(
                propertyId, orgId, lastMonth.minusYears(1).atDay(1),
                lastMonth.minusYears(1).plusMonths(1).atDay(1));
        if (previous == null || previous.signum() <= 0
                || current.compareTo(previous.multiply(REVENUE_DROP_RATIO)) >= 0) {
            return; // pas de base de comparaison, ou pas de recul marqué
        }
        final long dropPct = java.math.BigDecimal.ONE
                .subtract(current.divide(previous, 4, RoundingMode.HALF_UP))
                .movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
        suggestionService.recordActionable(
                orgId, propertyId, MODULE_OWN,
                "Note de revenus à envoyer — " + lastMonth + " (−" + dropPct + " %)",
                "Revenus de " + lastMonth + " : " + current + " € contre " + previous
                        + " € le même mois l'an dernier. « Envoyer » adresse une note factuelle "
                        + "au propriétaire (chiffres re-calculés à l'envoi, renvoi au relevé "
                        + "mensuel pour le détail) — devancer sa question plutôt que la subir.",
                SupervisionActionType.OWNER_REVENUE_NOTE,
                "{\"month\":\"" + lastMonth + "\"}", null, "info");
    }

    private void scanPendingPayouts(Long orgId, Long propertyId) {
        final List<OwnerPayout> pending = ownerPayoutRepository
                .findByStatus(OwnerPayout.PayoutStatus.PENDING, orgId);
        for (OwnerPayout payout : pending) {
            if (payout.getOwnerId() == null || payout.getNetAmount() == null
                    || payout.getNetAmount().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            // Ancre unique : la carte n'apparaît que sur le plus petit logement du
            // propriétaire (même convention que les cartes de relevé mensuel).
            final Long anchor = propertyRepository
                    .findFirstPropertyIdByOwnerAndOrg(payout.getOwnerId(), orgId);
            if (!propertyId.equals(anchor)) {
                continue;
            }
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OWN,
                    "Reversement propriétaire à approuver (#" + payout.getId() + ")",
                    "Reversement de " + payout.getNetAmount() + " " + payout.getCurrency()
                            + " (période " + payout.getPeriodStart() + " → " + payout.getPeriodEnd()
                            + "). « Approuver » notifie le propriétaire et passe le reversement en "
                            + "file de virement — le paiement lui-même reste le flux bancaire habituel.",
                    SupervisionActionType.OWNER_PAYOUT,
                    "{\"payoutId\":" + payout.getId() + "}",
                    payout.getNetAmount().movePointRight(2)
                            .setScale(0, RoundingMode.HALF_UP).longValueExact(),
                    "info");
        }
    }

    private void scanWorksApproval(Long orgId, Long propertyId) {
        final LocalDateTime now = LocalDateTime.now(clock);
        final List<Intervention> recent = interventionRepository.findByPropertyAndCreatedBetween(
                propertyId, orgId, now.minusDays(WORKS_LOOKBACK_DAYS), now);
        for (Intervention intervention : recent) {
            final BigDecimal cost = intervention.getActualCost() != null
                    ? intervention.getActualCost() : intervention.getEstimatedCost();
            if (intervention.getType() == null || !intervention.getType().contains("MAINTENANCE")
                    || cost == null || cost.compareTo(BigDecimal.valueOf(WORKS_THRESHOLD_EUR)) < 0
                    || intervention.getStatus() != com.clenzy.model.InterventionStatus.PENDING) {
                continue;
            }
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OWN,
                    "Accord travaux à demander (intervention #" + intervention.getId() + ")",
                    "« " + intervention.getTitle() + "» — coût estimé " + cost + " €, à la charge "
                            + "du propriétaire. « Envoyer » lui adresse la demande d'accord par "
                            + "email avant d'engager les travaux.",
                    SupervisionActionType.OWNER_WORKS_APPROVAL,
                    "{\"interventionId\":" + intervention.getId() + "}",
                    cost.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact(),
                    "info");
        }
    }
}
