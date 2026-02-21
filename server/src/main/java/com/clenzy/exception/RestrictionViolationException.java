package com.clenzy.exception;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

/**
 * Levee quand une reservation viole les restrictions de booking
 * (min_stay, max_stay, closed_to_arrival, etc.).
 *
 * Contient la liste des violations pour un retour detaille au client.
 * Mappee vers HTTP 422 UNPROCESSABLE_ENTITY par GlobalExceptionHandler.
 */
public class RestrictionViolationException extends RuntimeException {

    private final Long propertyId;
    private final LocalDate checkIn;
    private final LocalDate checkOut;
    private final List<String> violations;

    public RestrictionViolationException(Long propertyId, LocalDate checkIn, LocalDate checkOut,
                                          List<String> violations) {
        super("Violation des restrictions de reservation pour propriete " + propertyId
                + " [" + checkIn + ", " + checkOut + ") : " + String.join("; ", violations));
        this.propertyId = propertyId;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.violations = violations != null ? violations : Collections.emptyList();
    }

    public Long getPropertyId() { return propertyId; }
    public LocalDate getCheckIn() { return checkIn; }
    public LocalDate getCheckOut() { return checkOut; }
    public List<String> getViolations() { return violations; }
}
