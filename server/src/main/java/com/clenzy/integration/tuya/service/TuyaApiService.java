package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.config.TuyaConfig;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.model.TuyaConnection.TuyaConnectionStatus;
import com.clenzy.integration.tuya.repository.TuyaConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Service d'appels REST vers l'API Tuya Cloud.
 * Authentification : HMAC-SHA256 signing.
 * Region : Europe (openapi.tuyaeu.com).
 */
@Service
public class TuyaApiService {

    private static final Logger log = LoggerFactory.getLogger(TuyaApiService.class);

    private final TuyaConfig config;
    private final TuyaConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // Token cache en memoire (evite de requeter a chaque appel)
    private String cachedAccessToken;
    private String cachedRefreshToken;
    private LocalDateTime cachedTokenExpiry;

    public TuyaApiService(TuyaConfig config,
                          TuyaConnectionRepository connectionRepository,
                          TokenEncryptionService encryptionService,
                          TenantContext tenantContext) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    // ─── Token Management ───────────────────────────────────────

    /**
     * Obtient un access token depuis Tuya (grant_type=1, simple mode).
     * GET /v1.0/token?grant_type=1
     */
    @SuppressWarnings("unchecked")
    public String getAccessToken() {
        if (cachedAccessToken != null && cachedTokenExpiry != null
                && cachedTokenExpiry.minusMinutes(5).isAfter(LocalDateTime.now())) {
            return cachedAccessToken;
        }

        if (!config.isConfigured()) {
            throw new IllegalStateException("Configuration Tuya incomplete. Verifiez TUYA_ACCESS_ID et TUYA_ACCESS_SECRET.");
        }

        String path = "/v1.0/token?grant_type=1";
        String timestamp = String.valueOf(System.currentTimeMillis());
        String nonce = UUID.randomUUID().toString();

        // Sign for token request (no access_token in signature)
        String stringToSign = buildStringToSign("GET", path, "", null);
        String signStr = config.getAccessId() + timestamp + nonce + stringToSign;
        String sign = hmacSha256(signStr, config.getAccessSecret());

        HttpHeaders headers = new HttpHeaders();
        headers.set("client_id", config.getAccessId());
        headers.set("t", timestamp);
        headers.set("sign_method", "HMAC-SHA256");
        headers.set("sign", sign);
        headers.set("nonce", nonce);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class);

            if (response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Boolean success = (Boolean) body.get("success");
                if (Boolean.TRUE.equals(success)) {
                    Map<String, Object> result = (Map<String, Object>) body.get("result");
                    cachedAccessToken = (String) result.get("access_token");
                    cachedRefreshToken = (String) result.get("refresh_token");
                    int expireTime = ((Number) result.get("expire_time")).intValue();
                    cachedTokenExpiry = LocalDateTime.now().plusSeconds(expireTime);

                    log.info("Token Tuya obtenu, expire dans {}s", expireTime);
                    return cachedAccessToken;
                }
                throw new RuntimeException("Erreur Tuya token: " + body.get("msg"));
            }
            throw new RuntimeException("Reponse vide de Tuya");
        } catch (Exception e) {
            log.error("Erreur obtention token Tuya: {}", e.getMessage());
            throw new RuntimeException("Echec obtention token Tuya", e);
        }
    }

    // ─── Device Operations ──────────────────────────────────────

    /**
     * Recupere les infos d'un device.
     * GET /v1.0/devices/{device_id}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceInfo(String deviceId) {
        return doGet("/v1.0/devices/" + deviceId);
    }

    /**
     * Recupere les data points actuels d'un device.
     * GET /v1.0/devices/{device_id}/status
     * Le DP 12 ("noise_value") contient le niveau de bruit en dB.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceStatus(String deviceId) {
        return doGet("/v1.0/devices/" + deviceId + "/status");
    }

    /**
     * Recupere l'historique des data points d'un device.
     * GET /v2.0/devices/{device_id}/logs?start_time=...&end_time=...&type=7&size=100
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceLogs(String deviceId, long startTime, long endTime) {
        String path = "/v2.0/devices/" + deviceId + "/logs"
                + "?start_time=" + startTime
                + "&end_time=" + endTime
                + "&type=7"
                + "&size=100";
        return doGet(path);
    }

    /**
     * Envoie des commandes a un device.
     * POST /v1.0/devices/{device_id}/commands
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sendCommand(String deviceId, List<Map<String, Object>> commands) {
        Map<String, Object> body = Map.of("commands", commands);
        return doPost("/v1.0/devices/" + deviceId + "/commands", body);
    }

    // ─── Connection Management ──────────────────────────────────

    /**
     * Enregistre une connexion Tuya pour un utilisateur.
     */
    public TuyaConnection createConnection(String userId) {
        // Teste la connexion en obtenant un token
        String token = getAccessToken();

        TuyaConnection connection = connectionRepository.findByUserId(userId)
                .orElse(new TuyaConnection());

        connection.setUserId(userId);
        connection.setAccessTokenEncrypted(encryptionService.encrypt(token));
        if (cachedRefreshToken != null) {
            connection.setRefreshTokenEncrypted(encryptionService.encrypt(cachedRefreshToken));
        }
        connection.setTokenExpiresAt(cachedTokenExpiry);
        connection.setStatus(TuyaConnectionStatus.ACTIVE);
        connection.setErrorMessage(null);
        if (connection.getOrganizationId() == null) {
            connection.setOrganizationId(tenantContext.getRequiredOrganizationId());
        }

        return connectionRepository.save(connection);
    }

    public void disconnect(String userId) {
        connectionRepository.findByUserId(userId).ifPresent(connection -> {
            connection.setStatus(TuyaConnectionStatus.REVOKED);
            connectionRepository.save(connection);
        });
        // Clear cache
        cachedAccessToken = null;
        cachedTokenExpiry = null;
    }

    public boolean isConnected(String userId) {
        return connectionRepository.findByUserId(userId)
                .map(TuyaConnection::isActive)
                .orElse(false);
    }

    public Optional<TuyaConnection> getConnectionStatus(String userId) {
        return connectionRepository.findByUserId(userId);
    }

    // ─── HMAC-SHA256 Signing ────────────────────────────────────

    private String buildStringToSign(String method, String path, String body, String signatureHeaders) {
        String contentHash = sha256(body != null ? body : "");
        String headers = signatureHeaders != null ? signatureHeaders : "";

        // Extract path without query for sorting
        String url = path;

        return method.toUpperCase() + "\n"
                + contentHash + "\n"
                + headers + "\n"
                + url;
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash).toUpperCase();
        } catch (Exception e) {
            throw new RuntimeException("Erreur HMAC-SHA256", e);
        }
    }

    private String sha256(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Erreur SHA-256", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    // ─── HTTP Helpers ───────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> doGet(String path) {
        String token = getAccessToken();
        String timestamp = String.valueOf(System.currentTimeMillis());
        String nonce = UUID.randomUUID().toString();

        String stringToSign = buildStringToSign("GET", path, "", null);
        String signStr = config.getAccessId() + token + timestamp + nonce + stringToSign;
        String sign = hmacSha256(signStr, config.getAccessSecret());

        HttpHeaders headers = new HttpHeaders();
        headers.set("client_id", config.getAccessId());
        headers.set("access_token", token);
        headers.set("t", timestamp);
        headers.set("sign_method", "HMAC-SHA256");
        headers.set("sign", sign);
        headers.set("nonce", nonce);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class);

            Map<String, Object> body = response.getBody();
            if (body != null && Boolean.TRUE.equals(body.get("success"))) {
                return (Map<String, Object>) body.get("result");
            }
            String msg = body != null ? String.valueOf(body.get("msg")) : "unknown";
            throw new RuntimeException("Erreur API Tuya: " + msg);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur API Tuya GET {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Tuya", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> doPost(String path, Object requestBody) {
        String token = getAccessToken();
        String timestamp = String.valueOf(System.currentTimeMillis());
        String nonce = UUID.randomUUID().toString();

        String bodyJson;
        try {
            bodyJson = objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            bodyJson = "{}";
        }

        String stringToSign = buildStringToSign("POST", path, bodyJson, null);
        String signStr = config.getAccessId() + token + timestamp + nonce + stringToSign;
        String sign = hmacSha256(signStr, config.getAccessSecret());

        HttpHeaders headers = new HttpHeaders();
        headers.set("client_id", config.getAccessId());
        headers.set("access_token", token);
        headers.set("t", timestamp);
        headers.set("sign_method", "HMAC-SHA256");
        headers.set("sign", sign);
        headers.set("nonce", nonce);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path,
                    HttpMethod.POST,
                    new HttpEntity<>(bodyJson, headers),
                    Map.class);

            Map<String, Object> body = response.getBody();
            if (body != null && Boolean.TRUE.equals(body.get("success"))) {
                Object result = body.get("result");
                return result instanceof Map ? (Map<String, Object>) result : Map.of("result", result);
            }
            String msg = body != null ? String.valueOf(body.get("msg")) : "unknown";
            throw new RuntimeException("Erreur API Tuya: " + msg);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur API Tuya POST {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Tuya", e);
        }
    }
}
