package com.clenzy.service.marketdata;

import java.math.BigDecimal;
import java.time.YearMonth;

/**
 * Benchmark de marché d'une zone pour un mois de séjour — la donnée produite par
 * un {@link MarketDataProvider} et persistée dans {@code market_data_snapshots}.
 *
 * @param area         zone (ville, éventuellement quartier) telle que restituée par la source
 * @param countryCode  ISO-2 (MA, FR...) — null si inconnu
 * @param stayMonth    mois de séjour concerné
 * @param adr          prix moyen par nuit vendue/affichée selon la source
 * @param occupancyPct occupation en % (0-100)
 * @param revPar       revenu par logement disponible
 * @param currency     devise des montants (MAD natif pour le Maroc quand la source le permet)
 * @param sampleSize   nombre de biens distincts dans l'agrégat — porte le k-anonymat
 * @param confidence   indice 0-1 (densité de l'échantillon × fiabilité de la source)
 */
public record MarketBenchmark(
        String area,
        String countryCode,
        YearMonth stayMonth,
        BigDecimal adr,
        BigDecimal occupancyPct,
        BigDecimal revPar,
        String currency,
        int sampleSize,
        BigDecimal confidence) {
}
