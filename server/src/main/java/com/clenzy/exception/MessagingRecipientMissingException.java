package com.clenzy.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Levee quand on essaie d'envoyer un message guest mais qu'aucun
 * destinataire valide n'est resolu pour le canal demande.
 * <p>
 * Cas typique : reservation Airbnb / Booking.com importee via iCal
 * sans email guest, et l'utilisateur clique sur "Envoyer" / "Renvoyer"
 * dans l'historique.
 * <p>
 * Renvoyee en 400 par le controller pour eviter de polluer
 * l'historique avec des logs FAILED previsibles.
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class MessagingRecipientMissingException extends RuntimeException {
    private final Long reservationId;
    private final String channel;

    public MessagingRecipientMissingException(Long reservationId, String channel, String message) {
        super(message);
        this.reservationId = reservationId;
        this.channel = channel;
    }

    public Long getReservationId() { return reservationId; }
    public String getChannel() { return channel; }
}
