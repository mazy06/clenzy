package com.clenzy.service.maps;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

class BaitlyStaticMapServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef-test";
    private final StaticMapRequest request = new StaticMapRequest(48.8589, 2.3622, null, null, "fr");

    private BaitlyStaticMapService service(String secret, String rendererUrl) {
        return new BaitlyStaticMapService(new StaticMapSigner(secret),
                new StaticMapRenderer(rendererUrl, RestClient.builder()), "https://app.baitly.fr/");
    }

    @Test
    void whenConfigured_thenTagPointsToSignedPublicImage() {
        String tag = service(SECRET, "http://renderer:8080").generateMapImageTag(request, "Studio <Marais>", null);

        assertThat(tag).contains("src=\"https://app.baitly.fr/api/public/maps/static/" + request.toPayload() + ".");
        assertThat(tag).contains(".jpg\"");
        assertThat(tag).contains("alt=\"Carte - Studio &lt;Marais&gt;\"");
    }

    @Test
    void whenRendererOrSecretMissing_thenNoMap() {
        assertThat(service("", "http://renderer:8080").generateMapImageTag(request, "P", null)).isEmpty();
        assertThat(service(SECRET, "").generateMapImageTag(request, "P", null)).isEmpty();
    }
}
