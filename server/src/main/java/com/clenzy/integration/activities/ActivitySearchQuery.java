package com.clenzy.integration.activities;

/**
 * Critere de recherche d'activites autour d'un logement.
 */
public record ActivitySearchQuery(
    Double latitude,
    Double longitude,
    String city,
    String language,
    int limit
) {}
