package com.clenzy.integration.keynest;

import com.clenzy.dto.keyexchange.KeyNestStoreDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Client REST pour l'API KeyNest V3.
 * Endpoints :
 * - Recherche de stores proches (par lat/lng)
 * - Creation de cle + code de collecte
 * - Creation de code de collecte
 * - Annulation de code
 * - Statut d'une cle / code
 *
 * Circuit breaker Resilience4j pour resilience aux pannes KeyNest.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TODO [KEYNEST-3] — Valider les endpoints et formats de reponse
 *   Tous les endpoints ci-dessous sont bases sur la documentation publique
 *   KeyNest. Les URLs, parametres et formats de reponse JSON doivent etre
 *   valides avec la documentation officielle API V3 une fois les credentials
 *   obtenus.
 *
 *   Pour chaque endpoint, verifier :
 *   a) L'URL exacte (ex: /stores vs /locations vs /points)
 *   b) Les parametres query (lat/lng vs latitude/longitude)
 *   c) La methode HTTP (GET, POST, PUT, DELETE)
 *   d) Le format du body de la requete (noms des champs JSON)
 *   e) Le format de la reponse (noms des champs JSON, nested objects)
 *   f) Les codes HTTP retournes (200, 201, 204, 400, 401, 404, 429...)
 *
 * TODO [KEYNEST-4] — Valider le format d'authentification
 *   Actuellement : header "Authorization: Bearer <API_KEY>"
 *   KeyNest pourrait utiliser :
 *   - API Key dans un header custom (ex: X-Api-Key, X-KeyNest-Token)
 *   - Basic Auth
 *   - OAuth2 client_credentials flow
 *   Adapter buildHeaders() selon la doc officielle.
 *
 * TODO [KEYNEST-5] — Gestion du rate limiting
 *   KeyNest impose probablement des limites de taux (rate limits).
 *   - Verifier les headers de reponse : X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
 *   - Ajouter un Resilience4j RateLimiter en plus du CircuitBreaker
 *   - Logger les warnings quand on approche la limite
 *   - Configurer dans application.yml :
 *       resilience4j.ratelimiter.instances.keynest:
 *         limitForPeriod: 60
 *         limitRefreshPeriod: 60s
 *
 * TODO [KEYNEST-6] — Tests d'integration avec sandbox KeyNest
 *   Une fois les credentials sandbox obtenus :
 *   1. Ecrire un test d'integration pour chaque endpoint
 *   2. Valider les mappings de reponse (mapToStoreDto, etc.)
 *   3. Tester le circuit breaker avec des timeouts simules
 *   4. Tester avec des coordonnees GPS reelles (Paris, Lyon...)
 *   5. Verifier le comportement quand aucun store n'est trouve
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Service
public class KeyNestApiService {

    private static final Logger log = LoggerFactory.getLogger(KeyNestApiService.class);

    private final KeyNestConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public KeyNestApiService(KeyNestConfig config,
                             RestTemplate restTemplate,
                             ObjectMapper objectMapper) {
        this.config = config;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    // ─── Store search ────────────────────────────────────────────────────

    /**
     * Recherche les points KeyNest proches d'une coordonnee GPS.
     *
     * TODO [KEYNEST-3a] — Valider l'endpoint de recherche de stores
     *   URL actuelle : GET /stores?lat={lat}&lng={lng}&radius={radius}
     *   A verifier :
     *   - L'URL pourrait etre /locations, /points, /lockboxes, /stores/search
     *   - Les params pourraient etre latitude/longitude au lieu de lat/lng
     *   - Le radius pourrait etre en km, miles ou metres
     *   - La reponse pourrait etre wrappee : { "data": [...], "total": N }
     *   - Les champs du store : id, name, address, lat, lng, distance, opening_hours, type
     *     → adapter mapToStoreDto() selon les vrais noms de champs
     */
    @CircuitBreaker(name = "keynest", fallbackMethod = "searchStoresFallback")
    public List<KeyNestStoreDto> searchStores(double lat, double lng, double radiusKm) {
        if (!config.isConfigured()) {
            log.warn("KeyNest API non configuree (pas de cle API)");
            return List.of();
        }

        String url = String.format("%s/stores?lat=%f&lng=%f&radius=%f",
                config.getApiUrl(), lat, lng, radiusKm);

        try {
            HttpEntity<Void> request = new HttpEntity<>(buildHeaders());
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, request,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getBody() == null) return List.of();

            return response.getBody().stream()
                    .map(this::mapToStoreDto)
                    .filter(Objects::nonNull)
                    .toList();

        } catch (Exception e) {
            log.error("Erreur recherche stores KeyNest (lat={}, lng={}): {}", lat, lng, e.getMessage());
            throw e;
        }
    }

    @SuppressWarnings("unused")
    private List<KeyNestStoreDto> searchStoresFallback(double lat, double lng, double radiusKm, Throwable t) {
        log.warn("Fallback recherche stores KeyNest: {}", t.getMessage());
        return List.of();
    }

    // ─── Key + Code management ──────────────────────────────────────────

    /**
     * Cree une cle et genere un code de collecte.
     * Retourne {keyId, collectionCode}.
     *
     * TODO [KEYNEST-3b] — Valider l'endpoint de creation de cle
     *   URL actuelle : POST /keys   body: { "store_id", "label" }
     *   A verifier :
     *   - L'URL et la methode (POST /keys, POST /keys/create, PUT /stores/{id}/keys)
     *   - Les champs obligatoires du body (store_id, label, description, metadata...)
     *   - Le format de reponse : { "key_id", "collection_code" }
     *     ou { "id", "code", "status" } ou structure nested
     *   - Si KeyNest cree automatiquement un code ou s'il faut un 2e appel
     */
    @CircuitBreaker(name = "keynest", fallbackMethod = "createKeyFallback")
    public Map<String, String> createKeyWithCollectionCode(String storeId, String keyLabel) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("KeyNest API non configuree");
        }

        String url = config.getApiUrl() + "/keys";
        Map<String, Object> body = Map.of(
                "store_id", storeId,
                "label", keyLabel
        );

        try {
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, buildHeaders());
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, request,
                    new ParameterizedTypeReference<>() {}
            );

            Map<String, Object> result = response.getBody();
            if (result == null) throw new RuntimeException("Reponse vide de KeyNest");

            return Map.of(
                    "keyId", String.valueOf(result.getOrDefault("key_id", "")),
                    "collectionCode", String.valueOf(result.getOrDefault("collection_code", ""))
            );

        } catch (Exception e) {
            log.error("Erreur creation cle KeyNest (store={}): {}", storeId, e.getMessage());
            throw e;
        }
    }

    @SuppressWarnings("unused")
    private Map<String, String> createKeyFallback(String storeId, String keyLabel, Throwable t) {
        log.warn("Fallback creation cle KeyNest: {}", t.getMessage());
        throw new RuntimeException("Service KeyNest temporairement indisponible", t);
    }

    /**
     * Genere un nouveau code de collecte pour une cle existante.
     *
     * TODO [KEYNEST-3c] — Valider l'endpoint de creation de code
     *   URL actuelle : POST /keys/{keyId}/codes
     *   A verifier :
     *   - L'URL (POST /keys/{id}/codes, POST /codes, POST /collection-codes)
     *   - Les params optionnels (validFrom, validUntil, guestName, notes...)
     *   - Le format de reponse : { "code_id", "code" }
     */
    @CircuitBreaker(name = "keynest", fallbackMethod = "createCodeFallback")
    public Map<String, String> createCollectionCode(String keyId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("KeyNest API non configuree");
        }

        String url = config.getApiUrl() + "/keys/" + keyId + "/codes";

        try {
            HttpEntity<Void> request = new HttpEntity<>(buildHeaders());
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, request,
                    new ParameterizedTypeReference<>() {}
            );

            Map<String, Object> result = response.getBody();
            if (result == null) throw new RuntimeException("Reponse vide de KeyNest");

            return Map.of(
                    "codeId", String.valueOf(result.getOrDefault("code_id", "")),
                    "code", String.valueOf(result.getOrDefault("code", ""))
            );

        } catch (Exception e) {
            log.error("Erreur creation code KeyNest (key={}): {}", keyId, e.getMessage());
            throw e;
        }
    }

    @SuppressWarnings("unused")
    private Map<String, String> createCodeFallback(String keyId, Throwable t) {
        log.warn("Fallback creation code KeyNest: {}", t.getMessage());
        throw new RuntimeException("Service KeyNest temporairement indisponible", t);
    }

    /**
     * Annule un code de collecte.
     *
     * TODO [KEYNEST-3d] — Valider l'endpoint d'annulation de code
     *   URL actuelle : DELETE /codes/{codeId}
     *   A verifier :
     *   - La methode (DELETE vs POST /codes/{id}/cancel vs PUT /codes/{id} + status)
     *   - Si la reponse contient un body ou juste un 204 No Content
     */
    @CircuitBreaker(name = "keynest")
    public void cancelCode(String codeId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("KeyNest API non configuree");
        }

        String url = config.getApiUrl() + "/codes/" + codeId;

        try {
            HttpEntity<Void> request = new HttpEntity<>(buildHeaders());
            restTemplate.exchange(url, HttpMethod.DELETE, request, Void.class);
            log.info("Code KeyNest annule: {}", codeId);

        } catch (Exception e) {
            log.error("Erreur annulation code KeyNest (code={}): {}", codeId, e.getMessage());
            throw e;
        }
    }

    /**
     * Recupere le statut d'une cle.
     *
     * TODO [KEYNEST-3e] — Valider l'endpoint de statut de cle
     *   URL actuelle : GET /keys/{keyId}/status
     *   A verifier :
     *   - L'URL (GET /keys/{id}/status, GET /keys/{id}, GET /codes/{id}/status)
     *   - Le format de reponse (status string, last_event, timestamps...)
     *   - Les valeurs possibles de status (deposited, collected, returned, lost...)
     */
    @CircuitBreaker(name = "keynest")
    public Map<String, Object> getKeyStatus(String keyId) {
        if (!config.isConfigured()) {
            return Map.of("status", "UNKNOWN", "error", "API non configuree");
        }

        String url = config.getApiUrl() + "/keys/" + keyId + "/status";

        try {
            HttpEntity<Void> request = new HttpEntity<>(buildHeaders());
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET, request,
                    new ParameterizedTypeReference<>() {}
            );
            return response.getBody() != null ? response.getBody() : Map.of();

        } catch (Exception e) {
            log.error("Erreur statut cle KeyNest (key={}): {}", keyId, e.getMessage());
            return Map.of("status", "ERROR", "error", e.getMessage());
        }
    }

    // ─── Private helpers ────────────────────────────────────────────────

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("Authorization", "Bearer " + config.getApiKey());
        return headers;
    }

    private KeyNestStoreDto mapToStoreDto(Map<String, Object> raw) {
        try {
            KeyNestStoreDto dto = new KeyNestStoreDto();
            dto.setStoreId(String.valueOf(raw.getOrDefault("id", "")));
            dto.setName(String.valueOf(raw.getOrDefault("name", "")));
            dto.setAddress(String.valueOf(raw.getOrDefault("address", "")));
            dto.setLat(toDouble(raw.get("lat")));
            dto.setLng(toDouble(raw.get("lng")));
            dto.setDistanceKm(toDouble(raw.get("distance")));
            dto.setOpeningHours(String.valueOf(raw.getOrDefault("opening_hours", "")));
            dto.setType(String.valueOf(raw.getOrDefault("type", "")));
            return dto;
        } catch (Exception e) {
            log.warn("Erreur mapping store KeyNest: {}", e.getMessage());
            return null;
        }
    }

    private Double toDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }
}
