package com.clenzy.integration.minut.service;

import com.clenzy.integration.minut.config.MinutConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Service d'appels REST vers l'API Minut v8.
 * Endpoints : devices, sound levels, homes, events, disturbance, webhooks.
 */
@Service
public class MinutApiService {

    private static final Logger log = LoggerFactory.getLogger(MinutApiService.class);

    private final MinutConfig config;
    private final MinutOAuthService oAuthService;
    private final RestTemplate restTemplate;

    public MinutApiService(MinutConfig config, MinutOAuthService oAuthService) {
        this.config = config;
        this.oAuthService = oAuthService;
        this.restTemplate = new RestTemplate();
    }

    // ─── Devices ────────────────────────────────────────────────

    /**
     * Recupere les details d'un device.
     * GET /devices/{device_id}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDevice(String userId, String deviceId) {
        return doGet(userId, "/devices/" + deviceId, new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /**
     * Recupere les niveaux sonores d'un device.
     * GET /devices/{device_id}/sound_level_dba?start_at=...&end_at=...&time_resolution=...
     *
     * @param resolution en secondes (ex: 1800 pour 30min)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getSoundLevels(String userId, String deviceId,
                                               String startAt, String endAt, int resolution) {
        String path = "/devices/" + deviceId + "/sound_level_dba"
                + "?start_at=" + startAt
                + "&end_at=" + endAt
                + "&time_resolution=" + resolution;
        return doGet(userId, path, new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── Homes ──────────────────────────────────────────────────

    /**
     * Liste les homes d'une organisation.
     * GET /organizations/{org_id}/homes
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getOrganizationHomes(String userId, String organizationId) {
        return doGet(userId, "/organizations/" + organizationId + "/homes",
                new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /**
     * Recupere les details d'un home.
     * GET /homes/{home_id}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getHome(String userId, String homeId) {
        return doGet(userId, "/homes/" + homeId, new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── Events ─────────────────────────────────────────────────

    /**
     * Recupere les evenements d'un home.
     * GET /homes/{home_id}/events?start_at=...&end_at=...&event_type=...
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getHomeEvents(String userId, String homeId,
                                              String startAt, String endAt, String eventTypes) {
        StringBuilder path = new StringBuilder("/homes/" + homeId + "/events?limit=50");
        if (startAt != null) path.append("&start_at=").append(startAt);
        if (endAt != null) path.append("&end_at=").append(endAt);
        if (eventTypes != null) path.append("&event_type=").append(eventTypes);

        return doGet(userId, path.toString(), new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── Disturbance (monitoring bruit) ─────────────────────────

    /**
     * Recupere la configuration de monitoring bruit d'un home.
     * GET /homes/{home_id}/disturbance
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDisturbanceConfig(String userId, String homeId) {
        return doGet(userId, "/homes/" + homeId + "/disturbance",
                new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /**
     * Met a jour la configuration de monitoring bruit d'un home.
     * PUT /homes/{home_id}/disturbance
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> updateDisturbanceConfig(String userId, String homeId,
                                                        Map<String, Object> config) {
        return doPut(userId, "/homes/" + homeId + "/disturbance", config,
                new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── Webhooks ───────────────────────────────────────────────

    /**
     * Cree un webhook Minut.
     * POST /webhooks
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createWebhook(String userId, String url, List<String> eventTypes) {
        Map<String, Object> body = Map.of(
                "url", url,
                "event_types", eventTypes
        );
        return doPost(userId, "/webhooks", body, new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── HTTP helpers ───────────────────────────────────────────

    private <T> T doGet(String userId, String path, ParameterizedTypeReference<T> responseType) {
        String token = oAuthService.getValidAccessToken(userId);
        HttpHeaders headers = createHeaders(token);

        try {
            ResponseEntity<T> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    responseType);

            return response.getBody();
        } catch (Exception e) {
            log.error("Erreur API Minut GET {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Minut: " + e.getMessage(), e);
        }
    }

    private <T> T doPost(String userId, String path, Object body,
                          ParameterizedTypeReference<T> responseType) {
        String token = oAuthService.getValidAccessToken(userId);
        HttpHeaders headers = createHeaders(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<T> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    responseType);

            return response.getBody();
        } catch (Exception e) {
            log.error("Erreur API Minut POST {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Minut: " + e.getMessage(), e);
        }
    }

    private <T> T doPut(String userId, String path, Object body,
                         ParameterizedTypeReference<T> responseType) {
        String token = oAuthService.getValidAccessToken(userId);
        HttpHeaders headers = createHeaders(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<T> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.PUT,
                    new HttpEntity<>(body, headers),
                    responseType);

            return response.getBody();
        } catch (Exception e) {
            log.error("Erreur API Minut PUT {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Minut: " + e.getMessage(), e);
        }
    }

    private HttpHeaders createHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        return headers;
    }
}
