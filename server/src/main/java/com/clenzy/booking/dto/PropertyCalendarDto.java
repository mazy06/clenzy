package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Grille de calendrier publique d'une propriété pour le Booking Engine (CLZ Domaine 2) :
 * disponibilité + prix indicatif (nuitée) + min-nights par jour, sur un ou plusieurs mois.
 * Alimente le widget embarquable (sélection de dates).
 */
public record PropertyCalendarDto(
        Long propertyId,
        String currency,
        List<CalendarDayDto> days
) {
    public record CalendarDayDto(
            LocalDate date,
            boolean available,
            BigDecimal price,
            int minNights,
            boolean checkInOnly,
            boolean checkOutOnly
    ) {}

    /** Copie avec jours convertis dans une devise d'affichage (multi-devise). */
    public PropertyCalendarDto withDisplayCurrency(List<CalendarDayDto> newDays, String newCurrency) {
        return new PropertyCalendarDto(propertyId, newCurrency, newDays);
    }
}
