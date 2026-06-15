package com.clenzy.booking.model;

/**
 * Cycle de vie d'un domaine custom (Cloudflare for SaaS) : en attente de vérification DNS/TLS,
 * actif (TLS émis), ou en échec. Le sous-domaine `*.clenzy.site` est ACTIVE d'emblée (cert wildcard).
 */
public enum SiteDomainStatus {
    PENDING,
    ACTIVE,
    FAILED
}
