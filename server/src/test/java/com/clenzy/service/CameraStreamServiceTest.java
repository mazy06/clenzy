package com.clenzy.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("CameraStreamService")
class CameraStreamServiceTest {

    private final MediaTicketService tickets = new MediaTicketService("test-secret-key");
    private final CameraStreamService service = new CameraStreamService("/media", "http://localhost:1984", tickets);

    @Test
    @DisplayName("webrtcUrl — construit l'URL de lecture go2rtc + ticket media")
    void webrtcUrl_builds() {
        String url = service.webrtcUrl("cam_abc");
        assertThat(url).startsWith("/media/stream.html?src=cam_abc&t=");
        assertThat(tickets.verify("cam_abc", url.substring(url.indexOf("&t=") + 3))).isTrue();
    }

    @Test
    @DisplayName("webrtcUrl — null/vide -> null")
    void webrtcUrl_nullOrBlank() {
        assertThat(service.webrtcUrl(null)).isNull();
        assertThat(service.webrtcUrl("  ")).isNull();
    }

    @Test
    @DisplayName("snapshotUrl — construit l'URL de capture (poster) go2rtc + ticket media")
    void snapshotUrl_builds() {
        String url = service.snapshotUrl("cam_abc");
        assertThat(url).startsWith("/media/api/frame.jpeg?src=cam_abc&t=");
        assertThat(tickets.verify("cam_abc", url.substring(url.indexOf("&t=") + 3))).isTrue();
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

    /**
     * Audit 2026-07 (P3-01) — la source etait transmise telle quelle a l'API go2rtc pour
     * tout scheme autre que http(s) (« passthrough »). go2rtc supporte nativement la source
     * {@code exec:}, et la configuration deployee (alexxit/go2rtc:1.9.4) ne restreint pas les
     * sources : une source {@code exec:} enregistree depuis {@code POST /api/cameras} — ouvert
     * a tout compte authentifie — revenait a faire executer une commande dans le conteneur
     * media, place sur le meme reseau Docker que la base et Keycloak.
     */
    @Test
    @DisplayName("toGo2rtcSource — rejette les schemes hors allow-list (audit 2026-07 P3-01)")
    void toGo2rtcSource_rejectsNonAllowlistedSchemes() {
        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("exec:/bin/sh -c id"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exec");

        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("echo:hello"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("file:///etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("ffmpeg:rtsp://host/s"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("EXEC:/bin/sh"))
                .as("l'allow-list doit etre insensible a la casse")
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("toGo2rtcSource — rejette une valeur sans scheme")
    void toGo2rtcSource_rejectsSchemeless() {
        assertThatThrownBy(() -> CameraStreamService.toGo2rtcSource("host/stream"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("registerStream — une source hors allow-list n'atteint jamais go2rtc")
    void registerStream_rejectsNonAllowlistedScheme() {
        assertThatThrownBy(() -> service.registerStream("cam_x", "exec:/bin/sh -c id"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
