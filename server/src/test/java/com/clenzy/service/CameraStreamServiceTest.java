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
    @DisplayName("snapshotUrl — construit l'URL de capture (poster) go2rtc")
    void snapshotUrl_builds() {
        assertThat(service.snapshotUrl("cam_abc")).isEqualTo("/media/api/frame.jpeg?src=cam_abc");
    }

    @Test
    @DisplayName("snapshotUrl — null/vide -> null")
    void snapshotUrl_nullOrBlank() {
        assertThat(service.snapshotUrl(null)).isNull();
        assertThat(service.snapshotUrl("  ")).isNull();
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

    @Test
    @DisplayName("toGo2rtcSource — RTSP en passthrough")
    void toGo2rtcSource_rtspPassthrough() {
        assertThat(CameraStreamService.toGo2rtcSource("rtsp://user:pass@host:554/stream"))
                .isEqualTo("rtsp://user:pass@host:554/stream");
    }

    @Test
    @DisplayName("toGo2rtcSource — HTTP/HLS enveloppe en ffmpeg (transcode WebRTC)")
    void toGo2rtcSource_httpWrappedWithFfmpeg() {
        assertThat(CameraStreamService.toGo2rtcSource("https://cdn.example.com/live/stream.m3u8"))
                .isEqualTo("ffmpeg:https://cdn.example.com/live/stream.m3u8#video=h264#audio=opus#width=640#height=360");
        assertThat(CameraStreamService.toGo2rtcSource("http://cam.local/video.mp4"))
                .isEqualTo("ffmpeg:http://cam.local/video.mp4#video=h264#audio=opus#width=640#height=360");
    }

    @Test
    @DisplayName("toGo2rtcSource — scheme insensible a la casse")
    void toGo2rtcSource_caseInsensitive() {
        assertThat(CameraStreamService.toGo2rtcSource("HTTPS://cdn.example.com/s.m3u8"))
                .startsWith("ffmpeg:");
        assertThat(CameraStreamService.toGo2rtcSource("RTSP://host/s")).isEqualTo("RTSP://host/s");
    }
}
