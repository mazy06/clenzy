package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OpenWaSignatureVerifierTest {

    @Mock private WhatsAppConfigRepository configRepository;

    private static final String SECRET = "webhook-secret-123";
    private static final byte[] BODY = "{\"event\":\"message.received\"}".getBytes(StandardCharsets.UTF_8);

    private OpenWaSignatureVerifier verifier() {
        return new OpenWaSignatureVerifier(configRepository);
    }

    private void withSecret(String secret) {
        WhatsAppConfig c = new WhatsAppConfig();
        c.setOrganizationId(null);
        c.setOpenwaWebhookSecret(secret);
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.of(c));
    }

    private static String sign(byte[] body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }

    @Test
    void validSignature_returnsTrue() throws Exception {
        withSecret(SECRET);
        assertThat(verifier().isValid(BODY, sign(BODY, SECRET))).isTrue();
    }

    @Test
    void wrongSignature_returnsFalse() throws Exception {
        withSecret(SECRET);
        assertThat(verifier().isValid(BODY, sign(BODY, "autre-secret"))).isFalse();
    }

    @Test
    void tamperedBody_returnsFalse() throws Exception {
        withSecret(SECRET);
        String sig = sign(BODY, SECRET);
        byte[] tampered = "{\"event\":\"message.sent\"}".getBytes(StandardCharsets.UTF_8);
        assertThat(verifier().isValid(tampered, sig)).isFalse();
    }

    @Test
    void noConfig_returnsFalse() {
        when(configRepository.findFirstByOrganizationIdIsNull()).thenReturn(Optional.empty());
        assertThat(verifier().isValid(BODY, "sha256=deadbeef")).isFalse();
    }

    @Test
    void blankSecret_returnsFalse() {
        withSecret("");
        assertThat(verifier().isValid(BODY, "sha256=deadbeef")).isFalse();
    }

    @Test
    void nullHeader_returnsFalse() {
        withSecret(SECRET);
        assertThat(verifier().isValid(BODY, null)).isFalse();
    }

    @Test
    void headerWithoutPrefix_returnsFalse() throws Exception {
        withSecret(SECRET);
        String hexOnly = sign(BODY, SECRET).substring("sha256=".length());
        assertThat(verifier().isValid(BODY, hexOnly)).isFalse();
    }
}
