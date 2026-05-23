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
    // ─── Channels scaffoldes (stubs — pas encore d'adapter dedie) ─────────
    /** Trip.com (Asie / Chine) — connectivite via Open Distribution Platform (ODP). */
    TRIPCOM,
    /** HomeToGo (metamoteur) — partner ID + endpoint iCal. */
    HOMETOGO,
    /** Gathern (Saoudie B2B) — partenaire OTA local. */
    GATHERN,
    /** Rentelly (B2B) — plateforme courtage location. */
    RENTELLY,
    /** Kease (B2B) — plateforme MENA. */
    KEASE,
    /** Stay.sa (Saoudie B2B) — programme officiel SCTH. */
    STAY_SA,
    /** Mabeet (Saoudie B2B) — plateforme reservation. */
    MABEET,
    OTHER
}
