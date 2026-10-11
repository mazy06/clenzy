package com.clenzy.service.maps;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StaticMapSigningTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef-test";

    @Test
    void whenPayloadSignedByServer_thenSignatureVerifies() {
        StaticMapSigner signer = new StaticMapSigner(SECRET);
        String payload = new StaticMapRequest(48.8589, 2.3622, null, null, "fr").toPayload();

        assertThat(signer.verify(payload, signer.sign(payload))).isTrue();
    }

    @Test
    void whenPayloadTampered_thenSignatureIsRejected() {
        StaticMapSigner signer = new StaticMapSigner(SECRET);
        String signature = signer.sign(new StaticMapRequest(48.8589, 2.3622, null, null, "fr").toPayload());
        String forged = new StaticMapRequest(40.0, -3.7, null, null, "fr").toPayload();

        assertThat(signer.verify(forged, signature)).isFalse();
        assertThat(signer.verify(forged, "not-base64!")).isFalse();
    }

    @Test
    void whenSecretMissingOrTooShort_thenSigningIsDisabled() {
        assertThat(new StaticMapSigner("").isEnabled()).isFalse();
        assertThat(new StaticMapSigner("short").isEnabled()).isFalse();
        assertThat(new StaticMapSigner("").verify("abc", "abc")).isFalse();
    }

    @Test
    void whenPayloadRoundTrips_thenRequestIsIdentical() {
        StaticMapRequest request = new StaticMapRequest(48.8589, 2.3622, 48.8675, 2.3637, "ar");

        assertThat(StaticMapRequest.fromPayload(request.toPayload())).contains(request);
    }

    @Test
    void whenLanguageUnknownOrRegional_thenItIsNormalized() {
        assertThat(new StaticMapRequest(1, 2, null, null, "de").language()).isEqualTo("fr");
        assertThat(new StaticMapRequest(1, 2, null, null, "en-GB").language()).isEqualTo("en");
        assertThat(new StaticMapRequest(1, 2, null, null, null).language()).isEqualTo("fr");
    }

    @Test
    void whenPayloadIsGarbage_thenNoRequest() {
        assertThat(StaticMapRequest.fromPayload("%%%")).isEmpty();
        assertThat(StaticMapRequest.fromPayload("dm9pbGE")).isEmpty();
    }

    @Test
    void whenSinglePoint_thenRendererCentersOnTheProperty() {
        String path = StaticMapRenderer.path(new StaticMapRequest(48.8589, 2.3622, null, null, "fr"));

        assertThat(path).startsWith("/styles/baitly-paper-fr/static/2.362200,48.858900,15/600x300@2x.jpg?marker=");
        assertThat(path).contains("pin-property.png").doesNotContain("pin-key.png").doesNotContain("|");
    }

    @Test
    void whenStoreKnown_thenRendererFramesBothPoints() {
        String path = StaticMapRenderer.path(new StaticMapRequest(48.8589, 2.3622, 48.8675, 2.3637, "en"));

        assertThat(path).startsWith("/styles/baitly-paper-en/static/auto/600x300@2x.jpg?padding=0.4&marker=");
        assertThat(path).contains("pin-property.png").contains("pin-key.png");
    }
}
