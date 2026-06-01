package com.clenzy.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link ProdJwtDecoderConfig}.
 *
 * <p>Le test verifie que le bean {@link JwtDecoder} produit est :
 * <ul>
 *   <li>un {@link NimbusJwtDecoder} (donc capable de valider la signature via JWK)</li>
 *   <li>cable avec un {@link DelegatingOAuth2TokenValidator} qui combine
 *       <i>issuer validator</i> + {@link JwtAudienceValidator}</li>
 * </ul>
 *
 * <p>On n'instancie PAS Spring Context — c'est un test de logique pure sur la classe
 * de configuration. Le chargement conditionnel via {@code @Profile("prod")} est
 * garanti par Spring Boot et n'a pas besoin d'etre re-teste.</p>
 */
class ProdJwtDecoderConfigTest {

    private static final String JWK_SET_URI = "https://example.com/realms/clenzy/protocol/openid-connect/certs";
    private static final String ISSUER_URI = "https://example.com/realms/clenzy";
    private static final String EXPECTED_AUDIENCE = "clenzy-api";

    @Test
    void jwtDecoder_returnsNimbusDecoderWithDelegatingValidator() {
        ProdJwtDecoderConfig config = new ProdJwtDecoderConfig();

        JwtDecoder decoder = config.jwtDecoder(JWK_SET_URI, ISSUER_URI, EXPECTED_AUDIENCE);

        assertThat(decoder).isInstanceOf(NimbusJwtDecoder.class);
    }

    @Test
    void jwtDecoder_combinesIssuerAndAudienceValidators() {
        ProdJwtDecoderConfig config = new ProdJwtDecoderConfig();

        NimbusJwtDecoder decoder = (NimbusJwtDecoder) config.jwtDecoder(JWK_SET_URI, ISSUER_URI, EXPECTED_AUDIENCE);

        // Le validator pose via setJwtValidator() est stocke dans le champ prive 'jwtValidator'
        OAuth2TokenValidator<Jwt> validator =
                (OAuth2TokenValidator<Jwt>) ReflectionTestUtils.getField(decoder, "jwtValidator");

        assertThat(validator).isInstanceOf(DelegatingOAuth2TokenValidator.class);

        // Le delegating validator wrappe au moins 2 validators : issuer + audience.
        @SuppressWarnings("unchecked")
        Collection<OAuth2TokenValidator<Jwt>> delegates =
                (Collection<OAuth2TokenValidator<Jwt>>) ReflectionTestUtils.getField(validator, "tokenValidators");

        assertThat(delegates)
                .as("Le decodeur prod doit combiner issuer + audience validators")
                .hasSizeGreaterThanOrEqualTo(2)
                .anyMatch(v -> v instanceof JwtAudienceValidator);
    }

    @Test
    void jwtDecoder_audienceValidatorUsesProvidedExpectedAudience() {
        ProdJwtDecoderConfig config = new ProdJwtDecoderConfig();
        String customAudience = "clenzy-custom-api";

        NimbusJwtDecoder decoder = (NimbusJwtDecoder) config.jwtDecoder(JWK_SET_URI, ISSUER_URI, customAudience);

        OAuth2TokenValidator<Jwt> validator =
                (OAuth2TokenValidator<Jwt>) ReflectionTestUtils.getField(decoder, "jwtValidator");
        @SuppressWarnings("unchecked")
        Collection<OAuth2TokenValidator<Jwt>> delegates =
                (Collection<OAuth2TokenValidator<Jwt>>) ReflectionTestUtils.getField(validator, "tokenValidators");

        JwtAudienceValidator audienceValidator = (JwtAudienceValidator) delegates.stream()
                .filter(v -> v instanceof JwtAudienceValidator)
                .findFirst()
                .orElseThrow();

        String injectedAudience = (String) ReflectionTestUtils.getField(audienceValidator, "expectedAudience");
        assertThat(injectedAudience).isEqualTo(customAudience);
    }
}
