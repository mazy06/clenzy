package com.clenzy.exception;

import java.time.LocalDate;

/**
 * Levee lorsqu'une operation calendrier entre en conflit
 * avec des jours deja reserves ou bloques.
 *
 * Cas typique : tentative de double-booking.
 */
public class CalendarConflictException extends RuntimeException {

    private final Long propertyId;
    private final LocalDate from;
    private final LocalDate to;
    private final long conflictCount;

    public CalendarConflictException(Long propertyId, LocalDate from, LocalDate to, long conflictCount) {
        super(String.format("Conflit calendrier : %d jour(s) non disponible(s) pour la propriete %d " +
                "entre %s et %s", conflictCount, propertyId, from, to));
        this.propertyId = propertyId;
        this.from = from;
        this.to = to;
        this.conflictCount = conflictCount;
    }

    public Long getPropertyId() { return propertyId; }
    public LocalDate getFrom() { return from; }
    public LocalDate getTo() { return to; }
    public long getConflictCount() { return conflictCount; }
}
