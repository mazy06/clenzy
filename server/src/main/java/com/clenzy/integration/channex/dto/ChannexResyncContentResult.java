package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Resultat d'une re-synchronisation de contenu OTA pour une property.
 *
 * @param clenzyPropertyId   ID de la property Clenzy
 * @param propertyName       nom apres resync (re-scrape Airbnb)
 * @param scrapedName        nom recupere depuis Airbnb (peut etre null)
 * @param mappedAmenities    codes Clenzy ajoutes/preserves
 * @param rawAmenitiesRemaining noms OTA bruts qui restent a mapper
 * @param ignoredCount       nombre de raws drop car ignored
 */
public record ChannexResyncContentResult(
    Long clenzyPropertyId,
    String propertyName,
    String scrapedName,
    List<String> mappedAmenities,
    List<String> rawAmenitiesRemaining,
    int ignoredCount
) {}
