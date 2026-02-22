package com.clenzy.model;

/**
 * Canal d'origine d'un voyageur.
 * Utilise pour la deduplication et le tracking des sources.
 */
public enum GuestChannel {
    DIRECT,     // Reservation directe (site web, telephone)
    AIRBNB,     // Via Airbnb
    BOOKING,    // Via Booking.com
    VRBO,       // Via VRBO / Abritel
    ICAL,       // Import iCal (source generique)
    OTHER       // Autre canal
}
