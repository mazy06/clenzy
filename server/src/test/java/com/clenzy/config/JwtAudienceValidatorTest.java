package com.clenzy.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAudienceValidatorTest {

    private static final String EXPECTED = "clenzy-api";

    private static Jwt jwtWithAudience(List<String> audience) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .subject("user-1");
        if (audience != null) {
            builder.audience(audience);
        } else {
            // Pas de claim aud du tout (token n'ayant pas l'audience mapper Keycloak).
            builder.claim("scope", "openid");
        }
        return builder.build();
    }

    @Test
    void audienceContainsExpectedAmongOthers_returnsSuccess() {
        JwtAudienceValidator validator = new JwtAudienceValidator(EXPECTED);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWithAudience(List.of("clenzy-api", "account")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void audienceIsExactlyExpected_returnsSuccess() {
        JwtAudienceValidator validator = new JwtAudienceValidator(EXPECTED);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWithAudience(List.of("clenzy-api")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void audienceMissingExpected_returnsError() {
        JwtAudienceValidator validator = new JwtAudienceValidator(EXPECTED);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWithAudience(List.of("account")));

        assertThat(result.hasErrors()).isTrue();
    }

    @Test
    void audienceEmpty_returnsError() {
        JwtAudienceValidator validator = new JwtAudienceValidator(EXPECTED);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWithAudience(List.of()));

        assertThat(result.hasErrors()).isTrue();
    }

    @Test
    void audienceClaimAbsent_returnsError() {
        JwtAudienceValidator validator = new JwtAudienceValidator(EXPECTED);

        OAuth2TokenValidatorResult result =
                validator.validate(jwtWithAudience(null));

        assertThat(result.hasErrors()).isTrue();
    }
}
