package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Reponse de verification de disponibilite avec breakdown par nuit.
 */
public record AvailabilityResponseDto(
    boolean available,
    Long propertyId,
    String propertyName,
    LocalDate checkIn,
    LocalDate checkOut,
    int guests,
    int nights,
    List<NightBreakdown> breakdown,
    BigDecimal subtotal,
    BigDecimal cleaningFee,
    BigDecimal touristTax,
    BigDecimal total,
    String currency,
    Integer minStay,
    Integer maxGuests,
    String checkInTime,
    String checkOutTime,
    List<String> violations
) {
    public record NightBreakdown(
        LocalDate date,
        BigDecimal price,
        String rateType
    ) {}

    /**
     * Fabrique pour un resultat "non disponible".
     */
    public static AvailabilityResponseDto unavailable(Long propertyId, LocalDate checkIn,
                                                       LocalDate checkOut, int guests,
                                                       List<String> violations) {
        return new AvailabilityResponseDto(
            false, propertyId, null, checkIn, checkOut, guests, 0,
            List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            null, null, null, null, null, violations
        );
    }
}
