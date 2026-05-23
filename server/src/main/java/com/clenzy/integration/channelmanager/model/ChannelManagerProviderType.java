package com.clenzy.integration.channelmanager.model;

/**
 * Providers de Channel Manager (middleware logiciel d'agregation d'OTAs).
 *
 * <p>Distinction importante :</p>
 * <ul>
 *   <li><b>Channels</b> (tab dediee) = OTAs eux-memes (Airbnb, Booking.com, Vrbo)</li>
 *   <li><b>Channel Manager</b> (ici) = middleware logiciel qui se connecte a
 *     plusieurs OTAs simultanement, utile pour les OTAs niche ou regionaux
 *     sans integration directe</li>
 * </ul>
 */
public enum ChannelManagerProviderType {
    /** SiteMinder (Australie) — leader mondial, ~250 OTAs y compris niches. */
    SITEMINDER,
    /** Hostaway (US) — popularite croissante STR, integration native Airbnb. */
    HOSTAWAY,
    /** Rentals United (Espagne) — 60+ OTAs y compris MENA. */
    RENTALS_UNITED,
    /**
     * Channex (UK) — API REST moderne, 100+ OTAs (Airbnb, Booking, Vrbo, Expedia).
     * Recommande pour Clenzy : pricing pay-as-you-go (~12€/bien/mois), webhooks,
     * documentation publique complete (docs.channex.io). Plan d'integration :
     * {@code docs/strategy/channex-integration-plan.md}.
     */
    CHANNEX
}
