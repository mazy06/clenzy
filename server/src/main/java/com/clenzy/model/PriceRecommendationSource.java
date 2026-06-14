package com.clenzy.model;

/**
 * Origine d'une recommandation de prix (CLZ-P0-17).
 */
public enum PriceRecommendationSource {
    /** Heuristique déterministe (règles de yield). */
    RULE,
    /** Modèle de langage (justification en langage naturel). */
    LLM,
    /** Source externe (market data, provider tiers). */
    EXTERNAL
}
