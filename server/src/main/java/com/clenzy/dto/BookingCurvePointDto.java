package com.clenzy.dto;

/**
 * Point d'une booking curve : l'on-the-books d'un mois de séjour vu à
 * J-{@code daysBeforeMonthStart} avant le début du mois, comparé au même
 * lead-time l'an dernier (décalage 364 j).
 */
public record BookingCurvePointDto(
        int daysBeforeMonthStart,
        long otbNights,
        long stlyOtbNights) {
}
