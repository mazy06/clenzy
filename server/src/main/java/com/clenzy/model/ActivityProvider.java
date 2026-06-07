package com.clenzy.model;

/**
 * Plateformes d'activites / experiences (affiliation) integrables au livret.
 * Chaque provider a son {@link com.clenzy.integration.activities.ActivityCatalogClient}.
 */
public enum ActivityProvider {
    VIATOR,
    GETYOURGUIDE,
    KLOOK
}
