package com.clenzy.booking.service;

import com.clenzy.booking.dto.CancellationResultDto;
import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.CancellationRefundService;
import com.clenzy.service.StripeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Annulation self-service par le voyageur (CLZ Domaine 2). Sans TenantContext : l'org est résolue
 * par la clé API du booking engine (OrgContext côté controller). Le voyageur s'authentifie par
 * (code de confirmation + email guest) ; tout échec renvoie NotFound (anti-énumération).
 *
 * Aperçu : lecture seule (réutilise le calculateur de politique).
 * Annulation : libère le calendrier + passe la réservation à "cancelled" (transaction), puis émet
 * le remboursement Stripe PARTIEL (selon politique) HORS transaction (#2 : afterCommit + idempotency).
 */
@Service
public class PublicCancellationService {

    private static final Logger log = LoggerFactory.getLogger(PublicCancellationService.class);

    private final ReservationRepository reservationRepository;
    private final CancellationRefundService cancellationRefundService;
    private final CalendarEngine calendarEngine;
    private final StripeService stripeService;

    public PublicCancellationService(ReservationRepository reservationRepository,
                                     CancellationRefundService cancellationRefundService,
                                     CalendarEngine calendarEngine,
                                     StripeService stripeService) {
        this.reservationRepository = reservationRepository;
        this.cancellationRefundService = cancellationRefundService;
        this.calendarEngine = calendarEngine;
        this.stripeService = stripeService;
    }

    /** Aperçu du remboursement applicable si la réservation était annulée maintenant. */
    @Transactional(readOnly = true)
    public CancellationRefundPreviewDto preview(Long orgId, String confirmationCode, String email) {
        Reservation reservation = requireOwnedReservation(orgId, confirmationCode, email);
        return cancellationRefundService.computePreview(reservation, orgId);
    }

    /**
     * Annule la réservation et émet le remboursement applicable. Idempotent : une réservation
     * déjà annulée n'est ni re-traitée ni re-remboursée.
     */
    @Transactional
    public CancellationResultDto cancel(Long orgId, String confirmationCode, String email, String reason) {
        Reservation reservation = requireOwnedReservation(orgId, confirmationCode, email);

        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            return new CancellationResultDto("already_cancelled", BigDecimal.ZERO, null, null, 0);
        }

        CancellationRefundPreviewDto preview = cancellationRefundService.computePreview(reservation, orgId);

        // Libère le calendrier + statut, DANS la transaction.
        calendarEngine.cancel(reservation.getId(), orgId, null);
        reservation.setStatus("cancelled");

        BigDecimal refundAmount = preview.refundAmount();
        String sessionId = reservation.getStripeSessionId();
        boolean willRefund = sessionId != null && !sessionId.isBlank()
                && refundAmount != null && refundAmount.compareTo(BigDecimal.ZERO) > 0;
        if (willRefund) {
            reservation.setPaymentStatus(PaymentStatus.REFUNDED);
        }
        reservationRepository.save(reservation);

        // Remboursement Stripe HORS transaction (#2), idempotent (clé dérivée de la résa).
        if (willRefund) {
            final Long reservationId = reservation.getId();
            final long amountMinor = StripeAmounts.toMinorUnits(refundAmount);
            runAfterCommit(() -> {
                try {
                    stripeService.refundCheckoutSessionPartial(
                            sessionId, amountMinor, "cancel-refund-" + reservationId, reason);
                } catch (Exception e) {
                    // Annulation déjà committée ; échec refund -> réconciliation requise (pas de swallow muet, #7).
                    log.error("Annulation guest résa {} : remboursement Stripe en échec — réconciliation requise",
                            reservationId, e);
                }
            });
        }

        return new CancellationResultDto("cancelled",
                refundAmount != null ? refundAmount : BigDecimal.ZERO,
                preview.currency(), preview.policyType(), preview.refundPercentage());
    }

    /** Charge la réservation (org + code) et vérifie l'email guest. Échec → NotFound (anti-énumération). */
    private Reservation requireOwnedReservation(Long orgId, String confirmationCode, String email) {
        Reservation reservation = reservationRepository
                .findByConfirmationCodeAndOrganizationId(confirmationCode, orgId)
                .orElseThrow(() -> new NotFoundException("Réservation introuvable"));
        if (!emailMatches(reservation, email)) {
            throw new NotFoundException("Réservation introuvable");
        }
        return reservation;
    }

    private static boolean emailMatches(Reservation reservation, String email) {
        if (email == null || email.isBlank()) {
            return false;
        }
        String wanted = email.trim().toLowerCase(Locale.ROOT);
        String guestEmail = reservation.getGuest() != null ? reservation.getGuest().getEmail() : null;
        if (guestEmail != null && guestEmail.trim().toLowerCase(Locale.ROOT).equals(wanted)) {
            return true;
        }
        String linkEmail = reservation.getPaymentLinkEmail();
        return linkEmail != null && linkEmail.trim().toLowerCase(Locale.ROOT).equals(wanted);
    }

    /** Exécute après commit si une transaction est active (#2), sinon inline (tests). */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
