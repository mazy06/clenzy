package com.clenzy.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Remboursement d'une reservation a l'initiative du gestionnaire (campagne
 * T-10 — tool {@code initiate_refund}).
 *
 * <p><b>Mouvement d'argent PUR</b> : ne change PAS le statut de la reservation
 * (l'annulation reste {@code cancel_reservation} ; un geste commercial partiel
 * ne rend pas la resa « REFUNDED »). La contre-passation ledger est portee par
 * {@code StripeRefundService}.</p>
 *
 * <p>Regles absolues appliquees :</p>
 * <ul>
 *   <li><b>n°1 — montant jamais client-trusted</b> : le serveur calcule le
 *       remboursable (politique d'annulation pour CANCELLATION, cash reellement
 *       encaisse en plafond partout) ; un montant fourni est un cross-check
 *       (erreur si ecart) ;</li>
 *   <li><b>n°2 — appel Stripe HORS transaction</b> : cette methode n'est pas
 *       transactionnelle, l'appel part avec une cle d'idempotence derivee
 *       (retry sans double remboursement) ;</li>
 *   <li><b>n°3 — ownership</b> : findById contourne le filtre Hibernate →
 *       validation d'org explicite.</li>
 * </ul>
 */
@Service
public class ReservationRefundService {

    private static final Logger log = LoggerFactory.getLogger(ReservationRefundService.class);

    public static final String REASON_CANCELLATION = "CANCELLATION";
    public static final String REASON_GESTURE = "GESTURE";
    public static final String REASON_DISPUTE = "DISPUTE";

    /** Resultat du remboursement initie (retour compact pour le tool). */
    public record RefundOutcome(Long reservationId, long amountCents, String reason,
                                String idempotencyKey, String currency) {}

    private final ReservationRepository reservationRepository;
    private final CancellationRefundService cancellationRefundService;
    private final StripeService stripeService;

    public ReservationRefundService(ReservationRepository reservationRepository,
                                    CancellationRefundService cancellationRefundService,
                                    StripeService stripeService) {
        this.reservationRepository = reservationRepository;
        this.cancellationRefundService = cancellationRefundService;
        this.stripeService = stripeService;
    }

    /**
     * Initie un remboursement Stripe sur une reservation en paiement direct.
     *
     * @param reservationId reservation cible
     * @param amountCents   montant demande en centimes — null pour CANCELLATION
     *                      (= montant de la politique) ; REQUIS pour GESTURE/DISPUTE
     * @param reason        {@link #REASON_CANCELLATION} | {@link #REASON_GESTURE} | {@link #REASON_DISPUTE}
     * @param orgId         organisation du requester (contexte, jamais des args LLM)
     */
    public RefundOutcome initiateRefund(Long reservationId, Long amountCents,
                                        String reason, Long orgId) {
        String normalizedReason = normalizeReason(reason);
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("Reservation introuvable : " + reservationId));
        if (reservation.getOrganizationId() == null
                || !reservation.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Reservation " + reservationId + " hors organisation");
        }

        String sessionId = reservation.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalStateException("Reservation sans paiement Stripe direct — pour une "
                    + "reservation OTA, le remboursement se fait sur le canal (Airbnb/Booking).");
        }
        if (reservation.getPaymentStatus() == PaymentStatus.REFUNDED) {
            throw new IllegalStateException("Reservation deja remboursee.");
        }

        long refundCents = resolveAmountCents(reservation, amountCents, normalizedReason, orgId);

        // Cle d'idempotence derivee des parametres approuves : un retry du meme
        // remboursement ne double jamais ; un second geste distinct (autre montant) passe.
        String idempotencyKey = "agent-refund-" + reservationId + "-"
                + normalizedReason.toLowerCase(Locale.ROOT) + "-" + refundCents;
        try {
            stripeService.refundCheckoutSessionPartial(sessionId, refundCents,
                    idempotencyKey, "agent:" + normalizedReason);
        } catch (Exception e) {
            log.warn("initiate_refund resa {} en echec : {}", reservationId, e.getMessage());
            throw new IllegalStateException("Remboursement Stripe en echec : " + e.getMessage(), e);
        }

        String currency = reservation.getProperty() != null
                && reservation.getProperty().getDefaultCurrency() != null
                ? reservation.getProperty().getDefaultCurrency() : "EUR";
        return new RefundOutcome(reservationId, refundCents, normalizedReason,
                idempotencyKey, currency);
    }

    /**
     * Montant serveur : CANCELLATION = politique d'annulation (montant fourni =
     * cross-check strict) ; GESTURE/DISPUTE = montant requis, borne par le cash
     * reellement encaisse (total − credit fidelite consomme).
     */
    private long resolveAmountCents(Reservation reservation, Long amountCents,
                                    String reason, Long orgId) {
        long cashPaidCents = cashPaidCents(reservation);
        if (cashPaidCents <= 0) {
            throw new IllegalStateException("Aucun encaissement Stripe a rembourser sur cette reservation.");
        }

        if (REASON_CANCELLATION.equals(reason)) {
            CancellationRefundPreviewDto preview =
                    cancellationRefundService.computePreview(reservation, orgId);
            long policyCents = preview.refundAmount() != null
                    ? StripeAmounts.toMinorUnits(preview.refundAmount()) : 0L;
            long serverCents = Math.min(policyCents, cashPaidCents);
            if (serverCents <= 0) {
                throw new IllegalStateException("La politique d'annulation ("
                        + preview.policyType() + ") ne donne droit a aucun remboursement.");
            }
            if (amountCents != null && amountCents != serverCents) {
                throw new IllegalArgumentException("Ecart de montant : la politique d'annulation donne "
                        + serverCents + " cts, demande " + amountCents + " cts. Montant refuse.");
            }
            return serverCents;
        }

        if (amountCents == null || amountCents <= 0) {
            throw new IllegalArgumentException("amountCents est requis (et > 0) pour un remboursement "
                    + reason + ".");
        }
        if (amountCents > cashPaidCents) {
            throw new IllegalArgumentException("Montant demande (" + amountCents + " cts) superieur au "
                    + "cash reellement encaisse (" + cashPaidCents + " cts). Montant refuse.");
        }
        return amountCents;
    }

    /** Cash reellement encaisse via Stripe : total − credit fidelite consomme (jamais negatif). */
    private static long cashPaidCents(Reservation reservation) {
        BigDecimal total = reservation.getTotalPrice() != null
                ? reservation.getTotalPrice() : BigDecimal.ZERO;
        BigDecimal credit = reservation.getCreditApplied() != null
                ? reservation.getCreditApplied() : BigDecimal.ZERO;
        BigDecimal cash = total.subtract(credit);
        if (cash.compareTo(BigDecimal.ZERO) < 0) {
            return 0L;
        }
        return StripeAmounts.toMinorUnits(cash);
    }

    private static String normalizeReason(String reason) {
        if (reason == null) {
            throw new IllegalArgumentException("reason est requis (CANCELLATION | GESTURE | DISPUTE)");
        }
        String normalized = reason.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case REASON_CANCELLATION, REASON_GESTURE, REASON_DISPUTE -> normalized;
            default -> throw new IllegalArgumentException("reason invalide : " + reason
                    + " (attendu : CANCELLATION | GESTURE | DISPUTE)");
        };
    }
}
