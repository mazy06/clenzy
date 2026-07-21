package com.clenzy.dto;

import java.util.List;

/**
 * Booking curve d'un mois de séjour : montée de l'on-the-books au fil du
 * lead-time (points hebdomadaires), avec la courbe same-time-last-year.
 *
 * @param month  mois de séjour au format ISO "2026-08"
 * @param points du plus lointain (J-180) au plus récent, bornés à aujourd'hui
 */
public record BookingCurveDto(
        String month,
        List<BookingCurvePointDto> points) {
}
