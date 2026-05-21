package com.clenzy.integration.channel;

/**
 * Identifiant des channels supportes par le PMS.
 */
public enum ChannelName {
    AIRBNB,
    BOOKING,
    EXPEDIA,
    VRBO,
    ICAL,
    GOOGLE_VACATION_RENTALS,
    HOMEAWAY,
    TRIPADVISOR,
    AGODA,
    HOTELS_COM,
    DIRECT,
    /**
     * White-label booking engine widgets that conciergeries / propriétaires embed on their
     * own websites. Treated as a first-class "channel" so profile sync, KPIs, and the
     * Sync & Diagnostics UI work uniformly with external OTAs.
     */
    BOOKING_ENGINE,
    OTHER
}
