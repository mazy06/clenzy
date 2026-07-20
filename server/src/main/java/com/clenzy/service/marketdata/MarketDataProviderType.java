package com.clenzy.service.marketdata;

/**
 * Sources de données de marché (roadmap market data, décision 2026-07-20).
 * Toutes contractuelles ou sous licence ouverte — aucun scraping.
 */
public enum MarketDataProviderType {
    /** Agrégats anonymisés du réseau Baitly (k-anonymat) — prix VENDUS, pas affichés. */
    FIRST_PARTY,
    /** Datasets publiés sous licence ouverte (Inside Airbnb, open data tourisme). */
    OPEN_DATA,
    /** Fournisseur cible (API payante ~500-2000 $/an, MAD natif) — dormant sans clé. */
    AIRBTICS,
    /** Appoint pay-per-call (~0,01 $/appel) — dormant sans clé. */
    AIRROI
}
