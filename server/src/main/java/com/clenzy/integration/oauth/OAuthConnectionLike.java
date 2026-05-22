package com.clenzy.integration.oauth;

import java.time.Instant;

/**
 * Contrat commun a toutes les entites de connexion OAuth2 (PennylaneConnection,
 * DocuSignConnection, ...). Permet a {@link OAuthFlowEngine} de manipuler
 * n'importe quelle entite via cette interface (Dependency Inversion Principle).
 *
 * <h2>Pourquoi une interface plutot qu'une superclasse</h2>
 * Les entites JPA ont parfois des champs business specifiques (Pennylane :
 * pennylaneCompanyId, lastSyncAt). Avec une superclasse abstraite on aurait
 * une chaine d'heritage rigide. L'interface permet de garder les entites
 * concretes maitresses de leur structure tout en exposant un contrat OAuth.
 *
 * <h2>Encapsulation des tokens</h2>
 * Les tokens sont accedes sous leur forme chiffree uniquement.
 * Le dechiffrement est de la responsabilite du code applicatif (via
 * TokenEncryptionService) et n'apparait jamais sur cette interface : eviter
 * de logger / serialiser un token en clair par accident.
 */
public interface OAuthConnectionLike {

    Long getOrganizationId();
    void setOrganizationId(Long organizationId);

    Long getUserId();
    void setUserId(Long userId);

    /** Token d'acces chiffre (AES-256-GCM via TokenEncryptionService). */
    String getAccessTokenEncrypted();
    void setAccessTokenEncrypted(String encrypted);

    /** Refresh token chiffre. Peut etre null si le provider n'en delivre pas. */
    String getRefreshTokenEncrypted();
    void setRefreshTokenEncrypted(String encrypted);

    Instant getTokenExpiresAt();
    void setTokenExpiresAt(Instant at);

    Instant getRefreshTokenExpiresAt();
    void setRefreshTokenExpiresAt(Instant at);

    String getScopes();
    void setScopes(String scopes);

    OAuthConnectionStatus getOAuthStatus();
    void setOAuthStatus(OAuthConnectionStatus status);

    String getErrorMessage();
    void setErrorMessage(String message);

    Instant getConnectedAt();
    void setConnectedAt(Instant at);

    /**
     * True si l'access token expire dans moins de 5 minutes (le moteur
     * declenche un refresh preventif). Implementation par defaut.
     */
    default boolean isTokenExpiringSoon() {
        Instant expiresAt = getTokenExpiresAt();
        return expiresAt == null
            || expiresAt.isBefore(Instant.now().plusSeconds(300));
    }
}
