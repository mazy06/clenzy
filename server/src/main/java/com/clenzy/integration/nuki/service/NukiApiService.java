package com.clenzy.integration.nuki.service;

import com.clenzy.integration.nuki.config.NukiConfig;
import com.clenzy.service.smartlock.AccessCodeParams;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/**
 * Service d'appels REST vers la Nuki Web API.
 *
 * Documentation : https://api.nuki.io
 * Authentification : Bearer token OAuth2.
 *
 * Toutes les methodes sont protegees par @CircuitBreaker("nuki-api").
 */
@Service
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
public class NukiApiService {

    private static final Logger log = LoggerFactory.getLogger(NukiApiService.class);

    // Nuki lock actions
    public static final int ACTION_UNLOCK = 1;
    public static final int ACTION_LOCK = 2;
    public static final int ACTION_UNLATCH = 3;
    public static final int ACTION_LOCK_N_GO = 4;

    private final NukiConfig config;
    private final RestTemplate restTemplate;

    public NukiApiService(NukiConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
    }

    // ─── Lock Actions ───────────────────────────────────────────

    /**
     * Execute une action sur une serrure Nuki.
     *
     * @param smartlockId identifiant Nuki de la serrure
     * @param action      code action (1=unlock, 2=lock, 3=unlatch, 4=lock'n'go)
     * @param token       access token OAuth2 dechiffre
     */
    @CircuitBreaker(name = "nuki-api")
    public void lockAction(String smartlockId, int action, String token) {
        MDC.put("nukiSmartlockId", smartlockId);
        try {
            String url = config.getApiUrl() + "/smartlock/" + smartlockId + "/action";
            Map<String, Object> body = Map.of("action", action);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, buildHeaders(token));
            restTemplate.postForEntity(url, request, Void.class);

            log.info("Action Nuki {} executee sur smartlock {}", action, smartlockId);
        } finally {
            MDC.remove("nukiSmartlockId");
        }
    }

    // ─── Device Info ────────────────────────────────────────────

    /**
     * Recupere les informations d'une serrure Nuki.
     */
    @CircuitBreaker(name = "nuki-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getSmartlock(String smartlockId, String token) {
        MDC.put("nukiSmartlockId", smartlockId);
        try {
            String url = config.getApiUrl() + "/smartlock/" + smartlockId;
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(buildHeaders(token)),
                    new ParameterizedTypeReference<>() {}
            );
            return response.getBody();
        } finally {
            MDC.remove("nukiSmartlockId");
        }
    }

    /**
     * Liste toutes les serrures Nuki associees au compte.
     */
    @CircuitBreaker(name = "nuki-api")
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listSmartlocks(String token) {
        String url = config.getApiUrl() + "/smartlock";
        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildHeaders(token)),
                new ParameterizedTypeReference<>() {}
        );
        return response.getBody();
    }

    // ─── Access Codes (Web API Keypad) ──────────────────────────

    /**
     * Cree un code d'acces sur le keypad Nuki.
     *
     * @param smartlockId identifiant Nuki de la serrure
     * @param params      parametres du code
     * @param token       access token OAuth2 dechiffre
     * @return reponse Nuki contenant l'ID du code cree
     */
    @CircuitBreaker(name = "nuki-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> createWebApiCode(String smartlockId, AccessCodeParams params, String token) {
        MDC.put("nukiSmartlockId", smartlockId);
        try {
            String url = config.getApiUrl() + "/smartlock/" + smartlockId + "/auth";

            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("name", params.name());
            body.put("type", mapAccessCodeType(params.type()));
            if (params.code() != null) {
                body.put("code", Integer.parseInt(params.code()));
            }
            if (params.validFrom() != null) {
                body.put("allowedFromDate", params.validFrom().toInstant(ZoneOffset.UTC).toString());
            }
            if (params.validUntil() != null) {
                body.put("allowedUntilDate", params.validUntil().toInstant(ZoneOffset.UTC).toString());
            }

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, buildHeaders(token));
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.PUT,
                    request,
                    new ParameterizedTypeReference<>() {}
            );

            log.info("Code d'acces Nuki cree sur smartlock {}", smartlockId);
            return response.getBody();
        } finally {
            MDC.remove("nukiSmartlockId");
        }
    }

    /**
     * Supprime un code d'acces du keypad Nuki.
     */
    @CircuitBreaker(name = "nuki-api")
    public void deleteWebApiCode(String smartlockId, String codeId, String token) {
        MDC.put("nukiSmartlockId", smartlockId);
        try {
            String url = config.getApiUrl() + "/smartlock/" + smartlockId + "/auth/" + codeId;
            restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    new HttpEntity<>(buildHeaders(token)),
                    Void.class
            );

            log.info("Code d'acces Nuki {} supprime sur smartlock {}", codeId, smartlockId);
        } finally {
            MDC.remove("nukiSmartlockId");
        }
    }

    // ─── Helpers ────────────────────────────────────────────────

    private HttpHeaders buildHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    /**
     * Mappe le type de code Clenzy vers le type Nuki auth.
     * Nuki types: 0=App, 1=Bridge, 2=Fob, 3=Keypad (code), 13=Keypad (fingerprint)
     */
    private int mapAccessCodeType(AccessCodeParams.AccessCodeType type) {
        // Keypad code pour tous les types
        return 3;
    }
}
