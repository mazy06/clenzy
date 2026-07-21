package com.clenzy.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Agrégats du funnel booking engine (fondations RMS R1) sur une période.
 *
 * @param searches        recherches de disponibilité (SEARCH + SEARCH_NO_RESULT)
 * @param deniedSearches  recherches sans disponibilité (denied demand)
 * @param propertyViews   vues de fiche logement
 * @param checkoutStarts  checkouts initiés (reserve / reserve-batch)
 * @param confirmed       réservations directes confirmées sur la période (source reservations)
 * @param conversionPct   confirmed / searches en % (null si aucune recherche)
 * @param deniedPct       part des recherches sans disponibilité en % (null si aucune recherche)
 * @param daily           série quotidienne : date -> compteur par étape
 * @param topDenied       séjours demandés sans résultat les plus fréquents
 */
public record FunnelAnalyticsDto(
        LocalDate from,
        LocalDate to,
        long searches,
        long deniedSearches,
        long propertyViews,
        long checkoutStarts,
        long confirmed,
        Double conversionPct,
        Double deniedPct,
        List<DailyPoint> daily,
        List<DeniedStay> topDenied) {

    public record DailyPoint(LocalDate date, Map<String, Long> counts) {
    }

    public record DeniedStay(String checkIn, String checkOut, String guests, long count) {
    }
}
