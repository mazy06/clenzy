package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Positionnement d'un bien face au marché — le « double signal » de la roadmap
 * market data : le RÉALISÉ du bien (prix publié moyen, occupation à venir) vs le
 * MARCHÉ (benchmark de sa zone), avec la provenance et la confiance de la source
 * marché. Jamais un chiffre marché présenté comme sûr sans son indice.
 *
 * @param area              zone de comparaison (ville du bien)
 * @param propertyAdr       prix publié moyen du bien sur l'horizon (devise du bien)
 * @param propertyOccupancyPct occupation à venir du bien en % (0-100)
 * @param marketAdr         ADR marché de la zone (null si aucune source ne couvre)
 * @param marketOccupancyPct occupation marché en % (null si indisponible)
 * @param currency          devise des montants
 * @param deltaPct          écart prix bien vs marché en % (null si marché absent)
 * @param positioning       UNDERPRICED / ALIGNED / OVERPRICED / NO_MARKET_DATA
 * @param source            source du benchmark marché (FIRST_PARTY / OPEN_DATA / AIRBTICS / AIRROI)
 * @param confidence        indice 0-1 de la donnée marché (densité × fiabilité source)
 * @param headline          phrase de synthèse prête à afficher
 */
public record MarketPositioningDto(
        String area,
        BigDecimal propertyAdr,
        Double propertyOccupancyPct,
        BigDecimal marketAdr,
        BigDecimal marketOccupancyPct,
        String currency,
        Double deltaPct,
        String positioning,
        String source,
        BigDecimal confidence,
        String headline) {
}
