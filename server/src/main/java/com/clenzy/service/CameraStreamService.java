package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Passerelle media go2rtc : enregistre/retire les flux cote go2rtc (RTSP en
 * passthrough, HTTP/HLS via ffmpeg) et construit l'URL de lecture pour le frontend.
 *
 * Config :
 *   clenzy.go2rtc.api-url     (defaut http://clenzy-go2rtc:1984) — API interne
 *   clenzy.go2rtc.public-url  (defaut /media)                    — proxy nginx
 *
 * Les appels a l'API go2rtc sont best-effort : si go2rtc est indisponible, la
 * camera reste creee/supprimee cote Clenzy (le flux se resynchronise plus tard).
 */
@Service
public class CameraStreamService {

    private static final Logger log = LoggerFactory.getLogger(CameraStreamService.class);

    private final String publicBaseUrl;
    private final String apiUrl;
    private final RestClient restClient;

    public CameraStreamService(
            @Value("${clenzy.go2rtc.public-url:/media}") String publicBaseUrl,
            @Value("${clenzy.go2rtc.api-url:http://clenzy-go2rtc:1984}") String apiUrl) {
        this.publicBaseUrl = publicBaseUrl;
        this.apiUrl = apiUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(3000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    /** URL de lecture (page go2rtc embarquable) pour le frontend. */
    public String webrtcUrl(String streamName) {
        if (streamName == null || streamName.isBlank()) {
            return null;
        }
        return publicBaseUrl + "/stream.html?src=" + streamName;
    }

    /** Enregistre le flux cote go2rtc (best-effort). RTSP en passthrough, HTTP/HLS via ffmpeg. */
    public void registerStream(String streamName, String rtspUrl) {
        if (streamName == null || streamName.isBlank() || rtspUrl == null || rtspUrl.isBlank()) {
            return;
        }
        String src = toGo2rtcSource(rtspUrl);
        try {
            restClient.put()
                    .uri(apiUrl + "/api/streams?name={name}&src={src}", streamName, src)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Flux go2rtc enregistre: {} ({})", streamName,
                    src.startsWith("ffmpeg:") ? "transcode HTTP/HLS" : "RTSP passthrough");
        } catch (Exception e) {
            log.warn("go2rtc indisponible — flux {} non enregistre: {}", streamName, e.getMessage());
        }
    }

    /**
     * Construit le {@code src} go2rtc selon le scheme de l'URL fournie.
     * <ul>
     *   <li>{@code rtsp://} (et autres schemes natifs go2rtc) : passthrough — le H.264
     *       RTSP passe directement en WebRTC, sans transcodage (cout CPU nul).</li>
     *   <li>{@code http(s)://} (HLS {@code .m3u8}, MP4, flux HTTP) : go2rtc ne lit pas
     *       l'URL brute. On passe par ffmpeg avec transcodage {@code video=h264} /
     *       {@code audio=opus} (codecs natifs WebRTC) pour produire un flux lisible.</li>
     * </ul>
     */
    static String toGo2rtcSource(String url) {
        String lower = url.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            return "ffmpeg:" + url + "#video=h264#audio=opus";
        }
        return url;
    }

    /** Retire le flux cote go2rtc (best-effort). */
    public void removeStream(String streamName) {
        if (streamName == null || streamName.isBlank()) {
            return;
        }
        try {
            restClient.delete()
                    .uri(apiUrl + "/api/streams?src={src}", streamName)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Flux go2rtc retire: {}", streamName);
        } catch (Exception e) {
            log.warn("go2rtc indisponible — flux {} non retire: {}", streamName, e.getMessage());
        }
    }
}
