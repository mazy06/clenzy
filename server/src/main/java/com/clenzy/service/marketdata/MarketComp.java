package com.clenzy.service.marketdata;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Comparable par listing (comp set) — fourni par les sources externes qui le
 * supportent (Airbtics/AirROI). Le first-party n'en produit pas (agrégats
 * seulement, k-anonymat oblige).
 *
 * @param area       zone du comparable
 * @param stayDate   nuit concernée
 * @param nightlyPrice prix de la nuit
 * @param currency   devise
 * @param bedrooms   capacité (null si inconnue) — pour normaliser par segment
 */
public record MarketComp(
        String area,
        LocalDate stayDate,
        BigDecimal nightlyPrice,
        String currency,
        Integer bedrooms) {
}
