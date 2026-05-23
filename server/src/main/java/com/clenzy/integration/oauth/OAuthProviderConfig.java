package com.clenzy.integration.oauth;

/**
 * Configuration declarative d'un provider OAuth2.
 *
 * <h2>Role</h2>
 * Encapsule les parametres specifiques a chaque fournisseur (URLs, credentials,
 * scopes) pour que {@link OAuthFlowEngine} reste agnostique vis-a-vis du
 * provider. Chaque provider concret (Pennylane, DocuSign, ...) expose un bean
 * implementant cette interface, base sur ses propres {@code @ConfigurationProperties}.
 *
 * <h2>Pourquoi pas une simple classe avec des champs</h2>
 * Cote serveur, les credentials proviennent de differents prefix Spring
 * ({@code clenzy.pennylane.*}, {@code clenzy.docusign.*}). Une interface
 * permet a chaque module de garder son binding YAML actuel tout en partageant
 * le contrat avec le moteur OAuth.
 *
 * <h2>Securite</h2>
 * Le {@code clientSecret} est manipule via cette interface — ne JAMAIS le
 * logger. Le redirect URI doit etre verifie cote Keycloak / Security (whitelist
 * exacte).
 */
public interface OAuthProviderConfig {

    /** Type du provider (utilise par le registry et pour le routage REST). */
    String getProviderKey();

    String getClientId();
    String getClientSecret();
    String getRedirectUri();

    /** URL d'autorisation (ou l'utilisateur est redirige pour donner consentement). */
    String getAuthorizationUrl();

    /** URL d'echange du code contre un token + refresh. */
    String getTokenUrl();

    /**
     * URL de revocation. Optionnel : retourner null si le provider n'en expose
     * pas (le moteur log un warning et continue, on retire les tokens cote DB).
     */
    String getRevokeUrl();

    /** Scopes demandes, separes par espace selon RFC 6749. */
    String getScopes();

    /**
     * Duree de validite (jours) du refresh token. Defaut 90 jours — utilise
     * pour calculer refreshTokenExpiresAt en local (le provider ne le renvoie
     * pas toujours).
     */
    default int getRefreshTokenValidityDays() {
        return 90;
    }

    /**
     * Si true, le clientId/clientSecret est envoye dans le header
     * Authorization: Basic ... (RFC 6749 section 2.3.1 — methode preferee).
     * Si false, dans le body www-form (compatibilite).
     */
    default boolean useHttpBasicAuth() {
        return false;
    }

    /** Indique si le provider est configure (clientId + clientSecret presents). */
    default boolean isConfigured() {
        String id = getClientId();
        String secret = getClientSecret();
        return id != null && !id.isBlank() && secret != null && !secret.isBlank();
    }
}
