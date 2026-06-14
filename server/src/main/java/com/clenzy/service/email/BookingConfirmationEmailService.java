package com.clenzy.service.email;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.messaging.EmailWrapperService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Envoi de l'email de confirmation de reservation (booking direct, CLZ-P0-11).
 *
 * <p>Orchestrateur mince : (re)charge la reservation par id, compose le contenu
 * ({@link ReservationConfirmationEmailComposer}), applique le wrapper HTML
 * ({@link EmailWrapperService}) et delegue le transport a
 * {@link EmailService#sendSimpleHtmlEmail}. N'edite pas {@code EmailService}.</p>
 *
 * <p>Conçu pour etre invoque <b>apres commit</b> (audit #2 : aucun appel externe
 * dans la transaction metier) : le rechargement par id evite les relations lazy
 * detachees post-commit. Best-effort cote appelant (un echec d'email ne doit pas
 * impacter la confirmation de paiement).</p>
 */
@Service
public class BookingConfirmationEmailService {

    private static final Logger log = LoggerFactory.getLogger(BookingConfirmationEmailService.class);

    private final ReservationRepository reservationRepository;
    private final EmailService emailService;
    private final EmailWrapperService emailWrapperService;
    private final ReservationConfirmationEmailComposer composer;

    public BookingConfirmationEmailService(ReservationRepository reservationRepository,
                                           EmailService emailService,
                                           EmailWrapperService emailWrapperService,
                                           ReservationConfirmationEmailComposer composer) {
        this.reservationRepository = reservationRepository;
        this.emailService = emailService;
        this.emailWrapperService = emailWrapperService;
        this.composer = composer;
    }

    @Transactional(readOnly = true)
    public void sendForReservation(Long reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
        if (reservation == null) {
            log.warn("Email de confirmation : reservation {} introuvable", reservationId);
            return;
        }
        String email = resolveGuestEmail(reservation);
        if (email == null || email.isBlank()) {
            log.warn("Email de confirmation : aucune adresse guest pour la reservation {}", reservationId);
            return;
        }
        String html = emailWrapperService.wrap(composer.wrapperStyle(), composer.body(reservation));
        emailService.sendSimpleHtmlEmail(email, composer.subject(reservation), html);
        log.info("Email de confirmation envoye pour la reservation {} ({})",
                reservationId, reservation.getConfirmationCode());
    }

    private String resolveGuestEmail(Reservation reservation) {
        if (reservation.getGuest() != null
                && reservation.getGuest().getEmail() != null
                && !reservation.getGuest().getEmail().isBlank()) {
            return reservation.getGuest().getEmail();
        }
        return reservation.getPaymentLinkEmail();
    }
}
