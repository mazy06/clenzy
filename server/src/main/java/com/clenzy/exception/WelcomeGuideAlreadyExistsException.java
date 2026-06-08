package com.clenzy.exception;

/**
 * Levée quand on tente de créer un livret pour une réservation qui en a déjà un
 * (un seul livret par réservation). Le contrôleur la mappe en HTTP 409 ; le front
 * demande alors une confirmation d'écrasement (re-POST avec {@code overwrite=true}).
 */
public class WelcomeGuideAlreadyExistsException extends RuntimeException {

    private final Long existingGuideId;
    private final Long reservationId;

    public WelcomeGuideAlreadyExistsException(Long existingGuideId, Long reservationId) {
        super("Un livret existe déjà pour la réservation " + reservationId);
        this.existingGuideId = existingGuideId;
        this.reservationId = reservationId;
    }

    public Long getExistingGuideId() {
        return existingGuideId;
    }

    public Long getReservationId() {
        return reservationId;
    }
}
