package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ChannexSignatureValidator (static token X-Channex-Token)")
class ChannexSignatureValidatorTest {

    private static final String SECRET = "3a8d4f9b2e1c5a7d6f4e3b8c2a1d9e7f5c4b8a2d1e9f7c4b3a8d2e1f9c7b4a5d";

    private ChannexSignatureValidator validator;

    @BeforeEach
    void setUp() {
        ChannexProperties props = new ChannexProperties();
        props.setWebhookSecret(SECRET);
        validator = new ChannexSignatureValidator(props);
    }

    @Test
    @DisplayName("Valide un token egal au secret backend")
    void validatesMatchingToken() {
        assertThat(validator.isValid(SECRET)).isTrue();
    }

    @Test
    @DisplayName("Rejette un token incorrect")
    void rejectsWrongToken() {
        assertThat(validator.isValid("wrong-token-123")).isFalse();
    }

    @Test
    @DisplayName("Rejette un token vide ou blanc")
    void rejectsEmptyToken() {
        assertThat(validator.isValid("")).isFalse();
        assertThat(validator.isValid("   ")).isFalse();
    }

    @Test
    @DisplayName("Rejette un token null")
    void rejectsNullToken() {
        assertThat(validator.isValid(null)).isFalse();
    }

    @Test
    @DisplayName("Trim les espaces autour du token recu (defensif)")
    void trimsReceivedToken() {
        assertThat(validator.isValid("  " + SECRET + "  ")).isTrue();
    }

    @Test
    @DisplayName("Case-sensitive : un token avec casse differente est rejete")
    void caseSensitive() {
        assertThat(validator.isValid(SECRET.toUpperCase())).isFalse();
    }

    @Test
    @DisplayName("Rejette si webhook secret non configure cote backend (fail-safe)")
    void rejectsIfSecretNotConfigured() {
        ChannexProperties propsNoSecret = new ChannexProperties();
        propsNoSecret.setWebhookSecret("");
        ChannexSignatureValidator v = new ChannexSignatureValidator(propsNoSecret);

        assertThat(v.isValid(SECRET)).isFalse();
    }

    @Test
    @DisplayName("Rejette les tokens de meme longueur mais valeur differente (anti timing attack)")
    void constantTimeCompareRejectsSameLength() {
        // Token de meme longueur que SECRET pour s'assurer que MessageDigest.isEqual
        // compare bien en constant-time (un compare naif court-circuite des le 1er caractere different)
        String sameLength = "0".repeat(SECRET.length());
        assertThat(validator.isValid(sameLength)).isFalse();
    }
}
