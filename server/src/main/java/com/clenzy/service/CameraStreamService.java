package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Passerelle media go2rtc : enregistre/retire les flux RTSP cote go2rtc et
 * construit l'URL de lecture pour le frontend.
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

    /** Enregistre le flux RTSP cote go2rtc (best-effort). */
    public void registerStream(String streamName, String rtspUrl) {
        if (streamName == null || streamName.isBlank() || rtspUrl == null || rtspUrl.isBlank()) {
            return;
        }
        try {
            restClient.put()
                    .uri(apiUrl + "/api/streams?name={name}&src={src}", streamName, rtspUrl)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Flux go2rtc enregistre: {}", streamName);
        } catch (Exception e) {
            log.warn("go2rtc indisponible — flux {} non enregistre: {}", streamName, e.getMessage());
        }
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
