package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ChannexSignatureValidator (HMAC-SHA256)")
class ChannexSignatureValidatorTest {

    private static final String SECRET = "whsec_channex_test_secret_xyz";
    private static final String BODY = "{\"event\":\"booking_new\",\"property_id\":\"prop-1\"}";

    private ChannexSignatureValidator validator;

    @BeforeEach
    void setUp() {
        ChannexProperties props = new ChannexProperties();
        props.setWebhookSecret(SECRET);
        validator = new ChannexSignatureValidator(props);
    }

    @Test
    @DisplayName("Valide une signature correcte calculee avec le bon secret")
    void validatesCorrectSignature() throws Exception {
        String sig = computeHmac(BODY, SECRET);
        assertThat(validator.isValid(BODY, sig)).isTrue();
    }

    @Test
    @DisplayName("Rejette une signature falsifiee")
    void rejectsForgedSignature() {
        String wrongSig = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        assertThat(validator.isValid(BODY, wrongSig)).isFalse();
    }

    @Test
    @DisplayName("Rejette si le body a ete modifie post-signature (tamper)")
    void rejectsTamperedBody() throws Exception {
        String sig = computeHmac(BODY, SECRET);
        String tampered = BODY.replace("prop-1", "prop-2-evil");
        assertThat(validator.isValid(tampered, sig)).isFalse();
    }

    @Test
    @DisplayName("Rejette si le secret backend est different de celui qui a signe")
    void rejectsIfSecretMismatch() throws Exception {
        String sigWithWrongSecret = computeHmac(BODY, "different-secret");
        assertThat(validator.isValid(BODY, sigWithWrongSecret)).isFalse();
    }

    @Test
    @DisplayName("Insensible a la casse de la signature recue (Channex peut envoyer en upper)")
    void acceptsUppercaseSignature() throws Exception {
        String sig = computeHmac(BODY, SECRET).toUpperCase();
        assertThat(validator.isValid(BODY, sig)).isTrue();
    }

    @Test
    @DisplayName("Rejette body null/vide")
    void rejectsNullBody() {
        assertThat(validator.isValid(null, "abc")).isFalse();
    }

    @Test
    @DisplayName("Rejette signature null/blanche")
    void rejectsNullSignature() {
        assertThat(validator.isValid(BODY, null)).isFalse();
        assertThat(validator.isValid(BODY, "   ")).isFalse();
    }

    @Test
    @DisplayName("Rejette si webhook secret non configure cote backend (fail-safe)")
    void rejectsIfSecretNotConfigured() throws Exception {
        ChannexProperties propsNoSecret = new ChannexProperties();
        propsNoSecret.setWebhookSecret("");
        ChannexSignatureValidator v = new ChannexSignatureValidator(propsNoSecret);

        String sig = computeHmac(BODY, "any");
        assertThat(v.isValid(BODY, sig)).isFalse();
    }

    private String computeHmac(String body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
