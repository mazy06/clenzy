package com.clenzy.booking.service;

import com.clenzy.booking.dto.CancellationResultDto;
import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.CancellationRefundService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Annulation self-service par le voyageur (CLZ Domaine 2). Sans TenantContext : l'org est résolue
 * par la clé API du booking engine (OrgContext côté controller). Le voyageur s'authentifie par
 * (code de confirmation + email guest) ; tout échec renvoie NotFound (anti-énumération).
 *
 * Aperçu : lecture seule (réutilise le calculateur de politique).
 * Annulation : libère le calendrier + passe la réservation à "cancelled" (transaction), puis émet
 * une décision durable de remboursement. Le worker vérifie Stripe hors transaction.
 */
@Service
public class PublicCancellationService {

    private final ReservationRepository reservationRepository;
    private final CancellationRefundService cancellationRefundService;
    private final CalendarEngine calendarEngine;
    private final BookingCancellationRefunds refunds;
    private final GuestCreditService guestCreditService;

    public PublicCancellationService(ReservationRepository reservationRepository,
                                     CancellationRefundService cancellationRefundService,
                                     CalendarEngine calendarEngine,
                                     BookingCancellationRefunds refunds,
                                     GuestCreditService guestCreditService) {
        this.reservationRepository = reservationRepository;
        this.cancellationRefundService = cancellationRefundService;
        this.calendarEngine = calendarEngine;
        this.refunds = refunds;
        this.guestCreditService = guestCreditService;
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
        Reservation reservation = reservationRepository.lockCancellation(orgId, confirmationCode)
                .orElseThrow(() -> new NotFoundException("Réservation introuvable"));
        if (!emailMatches(reservation, email)) throw new NotFoundException("Réservation introuvable");

        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            return refunds.result(reservation, "already_cancelled");
        }

        CancellationRefundPreviewDto preview = cancellationRefundService.computePreview(reservation, orgId);

        // Libère le calendrier + statut, DANS la transaction.
        calendarEngine.cancel(reservation.getId(), orgId, null);
        reservation.markCancelled();

        BigDecimal refundAmount = preview.refundAmount();

        // Crédit fidélité (2.8) : re-créditer le crédit consommé (clawback) + ne jamais rembourser en
        // cash plus que le montant réellement encaissé (total - crédit). DANS la transaction.
        BigDecimal creditApplied = reservation.getCreditApplied() != null ? reservation.getCreditApplied() : BigDecimal.ZERO;
        if (creditApplied.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal cashPaid = reservation.getTotalPrice() != null
                ? reservation.getTotalPrice().subtract(creditApplied) : BigDecimal.ZERO;
            if (cashPaid.compareTo(BigDecimal.ZERO) < 0) {
                cashPaid = BigDecimal.ZERO;
            }
            if (refundAmount != null && refundAmount.compareTo(cashPaid) > 0) {
                refundAmount = cashPaid;
            }
            if (guestCreditService.wasRedeemed(orgId, confirmationCode)) {
                // L'adresse du lien de paiement peut authentifier le payeur sans être le titulaire du crédit.
                String creditEmail = reservation.getGuest() == null ? null : reservation.getGuest().getEmail();
                if (creditEmail == null) throw new IllegalStateException("Titulaire du crédit introuvable : rapprochement requis");
                guestCreditService.clawback(orgId, creditEmail, StripeAmounts.toMinorUnits(creditApplied), confirmationCode);
            }
        }

        refunds.prepare(reservation, preview, refundAmount);
        reservationRepository.save(reservation);
        return refunds.result(reservation, "cancelled");
    }

    /** Lecture authentifiée par le même code/email, sans nouvelle annulation ni émission PSP. */
    @Transactional(readOnly = true)
    public CancellationResultDto status(Long orgId, String confirmationCode, String email) {
        Reservation reservation = requireOwnedReservation(orgId, confirmationCode, email);
        return refunds.result(reservation, "cancelled".equalsIgnoreCase(reservation.getStatus())
                ? "already_cancelled" : reservation.getStatus());
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

}
