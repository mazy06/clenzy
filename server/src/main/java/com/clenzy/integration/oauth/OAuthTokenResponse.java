package com.clenzy.integration.oauth;

/**
 * Reponse standard d'un endpoint OAuth2 {@code /token} (RFC 6749 section 5.1).
 *
 * <p>Les champs non renseignes restent null. Le moteur OAuth gere les defauts
 * (par exemple expiresIn = 86400 si absent).</p>
 *
 * @param accessToken token d'acces (obligatoire)
 * @param refreshToken refresh token (optionnel selon le grant type / provider)
 * @param expiresIn duree de validite de l'access token en secondes
 * @param tokenType "Bearer" en general
 * @param scope scopes effectivement accordes par le provider
 */
public record OAuthTokenResponse(
        String accessToken,
        String refreshToken,
        Long expiresIn,
        String tokenType,
        String scope
) {}
