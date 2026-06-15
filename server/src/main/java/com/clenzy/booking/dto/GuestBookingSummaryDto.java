package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Résumé d'une réservation directe passée d'un voyageur connecté, exposé au widget pour le
 * re-booking 1-clic (2.11). Données minimales nécessaires à pré-remplir le flux de réservation
 * (logement + nombre de voyageurs) et à afficher la carte « Réserver à nouveau ».
 */
public record GuestBookingSummaryDto(
        String code,
        Long propertyId,
        String propertyName,
        LocalDate checkIn,
        LocalDate checkOut,
        int guests,
        String status,
        BigDecimal total,
        String currency) {
}
