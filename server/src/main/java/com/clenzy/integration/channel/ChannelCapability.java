package com.clenzy.integration.channel;

/**
 * Capacites supportees par un channel connector.
 * Permet de determiner dynamiquement ce qu'un channel sait faire.
 */
public enum ChannelCapability {
    /** Reception de mises a jour calendrier depuis le channel */
    INBOUND_CALENDAR,
    /** Envoi de mises a jour calendrier vers le channel */
    OUTBOUND_CALENDAR,
    /** Reception de reservations depuis le channel */
    INBOUND_RESERVATIONS,
    /** Envoi de mises a jour reservation vers le channel */
    OUTBOUND_RESERVATIONS,
    /** Le channel supporte les webhooks temps reel */
    WEBHOOKS,
    /** Le channel necessite un polling periodique */
    POLLING,
    /** Le channel supporte la messagerie guest */
    MESSAGING,
    /** Le channel utilise OAuth 2.0 */
    OAUTH,
    /** Le channel supporte la recuperation d'avis guests */
    REVIEWS,
    /** Le channel supporte les promotions (Genius, Preferred, etc.) */
    PROMOTIONS,
    /** Le channel supporte le push de restrictions de sejour (min/max stay, CTA, CTD) */
    OUTBOUND_RESTRICTIONS,
    /** Le channel supporte la sync de contenu (descriptions, photos, amenities) */
    CONTENT_SYNC,
    /** Le channel supporte la sync de frais supplementaires (menage, animaux, etc.) */
    FEES,
    /** Le channel supporte la sync de politiques d'annulation */
    CANCELLATION_POLICIES
}
