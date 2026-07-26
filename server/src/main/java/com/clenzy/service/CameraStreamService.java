package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Locale;
import java.util.Set;

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

    /** Schemes de source media acceptes ; tout le reste est refuse (audit 2026-07, P3-01). */
    private static final Set<String> ALLOWED_SOURCE_SCHEMES = Set.of("rtsp", "rtsps", "http", "https");

    private final String publicBaseUrl;
    private final String apiUrl;
    private final RestClient restClient;
    private final MediaTicketService mediaTicketService;

    public CameraStreamService(
            @Value("${clenzy.go2rtc.public-url:/media}") String publicBaseUrl,
            @Value("${clenzy.go2rtc.api-url:http://clenzy-go2rtc:1984}") String apiUrl,
            MediaTicketService mediaTicketService) {
        this.publicBaseUrl = publicBaseUrl;
        this.apiUrl = apiUrl;
        this.mediaTicketService = mediaTicketService;
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
        return publicBaseUrl + "/stream.html?src=" + streamName + "&t=" + mediaTicketService.mint(streamName);
    }

    /**
     * URL de capture d'une image fixe (poster) du flux via go2rtc. go2rtc tire la source
     * a la demande, encode une image JPEG, puis libere la source. Sert d'apercu avant lecture
     * (evite la dalle noire). Null si pas de flux.
     */
    public String snapshotUrl(String streamName) {
        if (streamName == null || streamName.isBlank()) {
            return null;
        }
        return publicBaseUrl + "/api/frame.jpeg?src=" + streamName + "&t=" + mediaTicketService.mint(streamName);
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
     *   <li>{@code rtsp://} / {@code rtsps://} : passthrough — le H.264 RTSP passe
     *       directement en WebRTC, sans transcodage (cout CPU nul).</li>
     *   <li>{@code http(s)://} (HLS {@code .m3u8}, MP4, flux HTTP) : go2rtc ne lit pas
     *       l'URL brute. On passe par ffmpeg avec transcodage {@code video=h264} /
     *       {@code audio=opus} (codecs natifs WebRTC) <b>cap a 640x360</b> pour limiter
     *       le CPU — le transcodage est lourd, c'est une source secondaire/test. Le
     *       RTSP, lui, passe en direct (passthrough) sans transcodage.</li>
     *   <li>tout autre scheme : <b>refuse</b> (voir {@link #assertAllowedSourceScheme}).</li>
     * </ul>
     */
    static String toGo2rtcSource(String url) {
        String scheme = assertAllowedSourceScheme(url);
        if ("http".equals(scheme) || "https".equals(scheme)) {
            return "ffmpeg:" + url + "#video=h264#audio=opus#width=640#height=360";
        }
        return url;
    }

    /**
     * Verifie que la source appartient a l'allow-list de schemes et retourne ce scheme
     * en minuscules.
     *
     * <p>Audit 2026-07 (P3-01) : la source etait auparavant transmise telle quelle a
     * l'API go2rtc pour tout scheme non-HTTP (« passthrough »). Or go2rtc supporte des
     * sources d'execution — {@code exec:} notamment — et la configuration deployee
     * ({@code alexxit/go2rtc:1.9.4}, {@code go2rtc/go2rtc.yaml}) ne restreint pas les
     * sources. Une URL de camera devenait donc une primitive d'execution de commande
     * dans le conteneur media, lui-meme sur le reseau Docker de la base et de Keycloak.
     * Comme {@code POST /api/cameras} est ouvert a tout compte authentifie, le vecteur
     * etait accessible a n'importe quel role, y compris HOUSEKEEPER.</p>
     *
     * <p>Le filtrage des adresses privees/loopback n'est <b>volontairement pas</b> fait
     * ici : une camera IP legitime peut vivre derriere une adresse RFC1918 selon la
     * topologie reseau du client. Restreindre les plages est une decision produit, a
     * instruire separement — la faille traitee ici est l'execution de commande.</p>
     *
     * @return le scheme valide, en minuscules
     * @throws IllegalArgumentException si le scheme est absent ou hors allow-list
     */
    static String assertAllowedSourceScheme(String url) {
        String scheme = schemeOf(url);
        if (!ALLOWED_SOURCE_SCHEMES.contains(scheme)) {
            throw new IllegalArgumentException(
                    "Schema de source camera non autorise: '" + scheme + "' — attendu "
                            + ALLOWED_SOURCE_SCHEMES);
        }
        return scheme;
    }

    /** Scheme d'une URI ({@code exec:...} comme {@code rtsp://...}), minuscules, "" si absent. */
    private static String schemeOf(String url) {
        if (url == null) {
            return "";
        }
        int separator = url.indexOf(':');
        return separator <= 0 ? "" : url.substring(0, separator).toLowerCase(Locale.ROOT);
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
