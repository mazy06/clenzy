package com.clenzy.model;

/**
 * Statut d'un jour dans le calendrier d'une propriete.
 */
public enum CalendarDayStatus {

    /** Disponible a la reservation */
    AVAILABLE,

    /** Reserve (lie a une reservation confirmee) */
    BOOKED,

    /** Bloque manuellement ou par une OTA (pas de reservation associee) */
    BLOCKED,

    /** En maintenance / indisponible temporairement */
    MAINTENANCE
}
