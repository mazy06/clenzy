package com.clenzy.exception;

/**
 * Levee lorsqu'il est impossible d'acquérir l'advisory lock
 * sur une propriete (une autre transaction est en cours).
 *
 * L'appelant peut retenter l'operation apres un court delai.
 */
public class CalendarLockException extends RuntimeException {

    private final Long propertyId;

    public CalendarLockException(Long propertyId) {
        super(String.format("Impossible d'acquerir le lock calendrier pour la propriete %d. " +
                "Une autre operation est en cours. Veuillez reessayer.", propertyId));
        this.propertyId = propertyId;
    }

    public Long getPropertyId() { return propertyId; }
}
