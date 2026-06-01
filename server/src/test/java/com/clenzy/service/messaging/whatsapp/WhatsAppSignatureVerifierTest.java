package com.clenzy.service.messaging.whatsapp;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppSignatureVerifierTest {

    private static final String SECRET = "meta-app-secret-xyz";

    private static String sign(byte[] body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(body));
    }

    @Test
    void validSignature_returnsTrue() throws Exception {
        byte[] body = "{\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        assertThat(verifier.isValid(body, "sha256=" + sign(body, SECRET))).isTrue();
    }

    @Test
    void validSignatureUppercaseHex_returnsTrue() throws Exception {
        byte[] body = "{\"x\":1}".getBytes(StandardCharsets.UTF_8);
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        assertThat(verifier.isValid(body, "sha256=" + sign(body, SECRET).toUpperCase())).isTrue();
    }

    @Test
    void wrongSecret_returnsFalse() throws Exception {
        byte[] body = "{\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        assertThat(verifier.isValid(body, "sha256=" + sign(body, "other-secret"))).isFalse();
    }

    @Test
    void tamperedBody_returnsFalse() throws Exception {
        byte[] signed = "{\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        byte[] tampered = "{\"entry\":[1]}".getBytes(StandardCharsets.UTF_8);
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        assertThat(verifier.isValid(tampered, "sha256=" + sign(signed, SECRET))).isFalse();
    }

    @Test
    void missingHeader_returnsFalse() {
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        assertThat(verifier.isValid("{}".getBytes(StandardCharsets.UTF_8), null)).isFalse();
    }

    @Test
    void headerWithoutPrefix_returnsFalse() throws Exception {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(SECRET);

        // Signature hex valide mais sans le prefixe "sha256="
        assertThat(verifier.isValid(body, sign(body, SECRET))).isFalse();
    }

    @Test
    void blankSecret_skipsVerificationReturnsTrue() {
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier("");

        assertThat(verifier.isValid("{}".getBytes(StandardCharsets.UTF_8), null)).isTrue();
    }

    @Test
    void nullSecret_skipsVerificationReturnsTrue() {
        WhatsAppSignatureVerifier verifier = new WhatsAppSignatureVerifier(null);

        assertThat(verifier.isValid("{}".getBytes(StandardCharsets.UTF_8), "sha256=whatever")).isTrue();
    }
}
