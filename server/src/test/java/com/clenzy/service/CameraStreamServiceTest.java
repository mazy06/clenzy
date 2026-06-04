package com.clenzy.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@DisplayName("CameraStreamService")
class CameraStreamServiceTest {

    private final CameraStreamService service = new CameraStreamService("/media", "http://localhost:1984");

    @Test
    @DisplayName("webrtcUrl — construit l'URL de lecture go2rtc")
    void webrtcUrl_builds() {
        assertThat(service.webrtcUrl("cam_abc")).isEqualTo("/media/stream.html?src=cam_abc");
    }

    @Test
    @DisplayName("webrtcUrl — null/vide -> null")
    void webrtcUrl_nullOrBlank() {
        assertThat(service.webrtcUrl(null)).isNull();
        assertThat(service.webrtcUrl("  ")).isNull();
    }

    @Test
    @DisplayName("registerStream — args manquants -> no-op sans appel reseau")
    void registerStream_guards() {
        assertThatCode(() -> service.registerStream(null, "rtsp://x")).doesNotThrowAnyException();
        assertThatCode(() -> service.registerStream("name", null)).doesNotThrowAnyException();
        assertThatCode(() -> service.registerStream("name", "  ")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("removeStream — null -> no-op")
    void removeStream_guard() {
        assertThatCode(() -> service.removeStream(null)).doesNotThrowAnyException();
    }
}
