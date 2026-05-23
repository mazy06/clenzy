package com.clenzy.integration.oauth;

/**
 * Statut d'une connexion OAuth2. Partage entre tous les providers
 * (Pennylane, DocuSign, ...) pour normaliser le vocabulaire.
 */
public enum OAuthConnectionStatus {
    /** Connexion active, access token valide ou refreshable. */
    ACTIVE,
    /** Access token expire, refresh token toujours valide (en theorie). */
    EXPIRED,
    /** Une erreur empeche le refresh (refresh token expire, API down, etc.). */
    ERROR,
    /** Connexion revoquee manuellement (deconnexion) ou par le provider. */
    REVOKED
}
