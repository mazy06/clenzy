package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Ligne mensuelle du rapport de pace : on-the-books du mois de séjour vu
 * aujourd'hui, comparé au same-time-last-year (même lead-time, décalage 364 j
 * pour aligner les jours de semaine), avec le pickup récent.
 *
 * @param month            mois de séjour au format ISO "2026-08"
 * @param otbNights        nuits réservées à date (on-the-books)
 * @param otbRevenue       revenu proratisé des nuits on-the-books
 * @param stlyNights       nuits on-the-books au même lead-time l'an dernier
 * @param paceVsStlyPct    écart OTB vs STLY en % (null si STLY = 0)
 * @param pickup7Nights    nuits gagnées sur les 7 derniers jours
 * @param pickup28Nights   nuits gagnées sur les 28 derniers jours
 * @param occupancyOtbPct  occupation on-the-books en % (null si aucune nuit disponible)
 */
public record PaceMonthDto(
        String month,
        long otbNights,
        BigDecimal otbRevenue,
        long stlyNights,
        Double paceVsStlyPct,
        long pickup7Nights,
        long pickup28Nights,
        Double occupancyOtbPct) {
}
