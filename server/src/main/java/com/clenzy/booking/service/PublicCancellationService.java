package com.clenzy.booking.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CancellationRefundService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Annulation self-service par le voyageur (CLZ Domaine 2). Sans TenantContext : l'org est résolue
 * par la clé API du booking engine (OrgContext côté controller) et passée ici. Le voyageur
 * s'authentifie par (code de confirmation + email guest) ; tout échec renvoie NotFound
 * (anti-énumération — ne pas révéler si un code existe).
 *
 * Incrément 1 : aperçu de remboursement (lecture seule, réutilise le calculateur de politique).
 * L'action d'annulation + remboursement Stripe (partiel selon politique) = incrément suivant.
 */
@Service
public class PublicCancellationService {

    private final ReservationRepository reservationRepository;
    private final CancellationRefundService cancellationRefundService;

    public PublicCancellationService(ReservationRepository reservationRepository,
                                     CancellationRefundService cancellationRefundService) {
        this.reservationRepository = reservationRepository;
        this.cancellationRefundService = cancellationRefundService;
    }

    /** Aperçu du remboursement applicable si la réservation était annulée maintenant. */
    @Transactional(readOnly = true)
    public CancellationRefundPreviewDto preview(Long orgId, String confirmationCode, String email) {
        Reservation reservation = requireOwnedReservation(orgId, confirmationCode, email);
        return cancellationRefundService.computePreview(reservation, orgId);
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
