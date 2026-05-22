package com.clenzy.integration.pricing.model;

/**
 * Fournisseurs de tarification dynamique (revenue management) supportes.
 *
 * <p>Tous utilisent une authentification par API key. La logique business
 * (recuperation de prix recommandes, push de pricing rules) sera ajoutee
 * une fois que les comptes developpeurs seront actifs cote Clenzy.</p>
 */
public enum PricingProviderType {
    /** PriceLabs (NYC) — leader avec ~250k listings, focus court-sejour. */
    PRICELABS,
    /** Beyond (ex-Beyond Pricing) — concurrent direct de PriceLabs. */
    BEYOND,
    /** Wheelhouse (San Francisco) — 3eme acteur majeur du marche, focus pricing
     *  comparatif vs concurrents directs dans la zone geographique. */
    WHEELHOUSE
}
