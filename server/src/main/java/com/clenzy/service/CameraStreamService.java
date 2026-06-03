package com.clenzy.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Construit les URLs de lecture des flux camera servis par la passerelle media
 * go2rtc. L'URL publique est configurable via {@code clenzy.go2rtc.public-url}
 * (defaut {@code /media}, proxifie par nginx).
 *
 * NB : l'enregistrement effectif du flux RTSP cote go2rtc (API streams) sera
 * branche avec l'infra go2rtc (clenzy-infra). Ce service ne construit pour
 * l'instant que l'URL de lecture exposee au frontend.
 */
@Service
public class CameraStreamService {

    private final String publicBaseUrl;

    public CameraStreamService(@Value("${clenzy.go2rtc.public-url:/media}") String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }

    /** URL de lecture WebRTC du flux (servie par go2rtc) pour le frontend. */
    public String webrtcUrl(String streamName) {
        if (streamName == null || streamName.isBlank()) {
            return null;
        }
        return publicBaseUrl + "/webrtc.html?src=" + streamName;
    }
}
