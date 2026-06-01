package com.clenzy.config;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;

/**
 * Valide que la claim {@code aud} du JWT contient l'audience attendue
 * (le client backend, ex. {@code clenzy-api}).
 *
 * <p>Complement de la validation d'issuer : l'issuer protege du <b>cross-realm</b>
 * (un token {@code clenzy-guests} est rejete sur l'API PMS), l'audience protege du
 * <b>cross-client intra-realm</b> (un token emis pour un autre client du realm
 * {@code clenzy} est rejete par l'API).</p>
 *
 * <p><b>Prerequis Keycloak</b> : un <i>Audience mapper</i> doit injecter
 * {@code clenzy-api} dans la claim {@code aud} des access tokens. Sans ce mapper,
 * les tokens Keycloak portent {@code aud: "account"} par defaut et seraient TOUS
 * rejetes — c'est pourquoi l'activation est gardee derriere le flag
 * {@code clenzy.security.jwt.audience-validation-enabled} (voir
 * {@link ProdJwtDecoderConfig}).</p>
 */
class JwtAudienceValidator implements OAuth2TokenValidator<Jwt> {

    private final String expectedAudience;
    private final OAuth2Error error;

    JwtAudienceValidator(String expectedAudience) {
        this.expectedAudience = expectedAudience;
        this.error = new OAuth2Error(
                "invalid_token",
                "L'audience requise est absente du token: " + expectedAudience,
                null);
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        List<String> audience = token.getAudience();
        if (audience != null && audience.contains(expectedAudience)) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(error);
    }
}
