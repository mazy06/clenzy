package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.config.TuyaConfig;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.model.TuyaConnection.TuyaConnectionStatus;
import com.clenzy.integration.tuya.dto.TuyaDeviceDto;
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
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.LinkedHashMap;
import java.util.regex.Pattern;

/**
 * Service d'appels REST vers l'API Tuya Cloud.
 * Authentification : HMAC-SHA256 signing.
 * Region : Europe (openapi.tuyaeu.com).
 */
@Service
public class TuyaApiService {

    private static final Logger log = LoggerFactory.getLogger(TuyaApiService.class);

    /** Regex pour valider les device IDs Tuya — alphanumerique, tirets, underscores uniquement.
     *  Bloque les tentatives de path traversal (../, caracteres speciaux). */
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{1,64}$");

    private final TuyaConfig config;
    private final TuyaConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;
    private final TenantContext tenantContext;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final TuyaDeviceClaimService claimService;

    // Token cache en memoire (evite de requeter a chaque appel)
    private String cachedAccessToken;
    private String cachedRefreshToken;
    private LocalDateTime cachedTokenExpiry;

    public TuyaApiService(TuyaConfig config,
                          TuyaConnectionRepository connectionRepository,
                          TokenEncryptionService encryptionService,
                          TenantContext tenantContext,
                          RestTemplate restTemplate,
                          TuyaDeviceClaimService claimService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
        this.tenantContext = tenantContext;
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.claimService = claimService;
    }

    // ─── Token Management ───────────────────────────────────────

    /**
     * Obtient un access token depuis Tuya (grant_type=1, simple mode).
     * GET /v1.0/token?grant_type=1
     */
    @CircuitBreaker(name = "tuya-api")
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
     * Valide un device ID contre les tentatives de path traversal.
     * Autorise uniquement alphanumerique, tirets et underscores.
     */
    private void validateDeviceId(String deviceId) {
        if (deviceId == null || !DEVICE_ID_PATTERN.matcher(deviceId).matches()) {
            throw new IllegalArgumentException("Device ID invalide: caracteres non autorises");
        }
    }

    /**
     * Recupere les infos d'un device.
     * GET /v1.0/devices/{device_id}
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceInfo(String deviceId) {
        validateDeviceId(deviceId);
        return doGet("/v1.0/devices/" + deviceId);
    }

    // ─── Decouverte de devices (plug-and-play) ──────────────────

    /**
     * Liste les devices du compte Tuya de l'organisation courante. Verifie qu'une connexion Tuya
     * ACTIVE existe pour l'org, puis liste TOUS les devices lies au projet via
     * {@link #listAssociatedDevices()} — <b>sans uid</b> (le tuya_uid n'est pas resolu a la connexion ;
     * l'endpoint projet liste les devices de tous les comptes app associes).
     */
    @CircuitBreaker(name = "tuya-api")
    public List<TuyaDeviceDto> listOrgDevices() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        connectionRepository
                .findFirstByOrganizationIdAndStatusOrderByConnectedAtDesc(orgId, TuyaConnectionStatus.ACTIVE)
                .orElseThrow(() -> new IllegalStateException("Aucun compte Tuya relie pour cette organisation"));
        Set<String> otherOrg = claimService.claimedByOtherOrgs();
        Set<String> myOrg = claimService.claimedByCurrentOrg();
        List<TuyaDeviceDto> segmented = new ArrayList<>();
        for (TuyaDeviceDto d : listAssociatedDevices()) {
            if (otherOrg.contains(d.id())) {
                continue; // segmentation : masque les devices reclames par une autre org
            }
            segmented.add(new TuyaDeviceDto(d.id(), d.name(), d.category(), d.productName(), d.online(),
                    myOrg.contains(d.id())));
        }
        return segmented;
    }

    /**
     * Liste les devices d'un compte Tuya. GET /v1.0/users/{uid}/devices (token plateforme).
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public List<TuyaDeviceDto> listDevices(String tuyaUid) {
        Map<String, Object> resp = doGet("/v1.0/users/" + tuyaUid + "/devices");
        Object result = resp == null ? null : resp.get("result");
        if (!(result instanceof List<?> list)) {
            return List.of();
        }
        List<TuyaDeviceDto> devices = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
                Map<String, Object> d = (Map<String, Object>) m;
                devices.add(new TuyaDeviceDto(
                        asString(d.get("id")),
                        asString(d.get("name")),
                        asString(d.get("category")),
                        asString(d.get("product_name")),
                        Boolean.TRUE.equals(d.get("online")),
                        false));
            }
        }
        return devices;
    }

    /**
     * Liste TOUS les devices lies au projet Tuya (tous les comptes app associes), <b>sans uid</b>.
     * GET /v1.0/iot-01/associated-users/devices — la reponse est {@code result.devices} (et non
     * {@code result} directement comme pour /v1.0/users/{uid}/devices). Une seule page (size=100,
     * un seul query param -> signature triviale) ; couvre la quasi-totalite des orgs. Si Tuya
     * renvoie {@code has_more}, on logue (pagination a ajouter si une org depasse 100 devices).
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public List<TuyaDeviceDto> listAssociatedDevices() {
        Map<String, Object> resp = doGet("/v1.0/iot-01/associated-users/devices?size=100");
        List<TuyaDeviceDto> devices = new ArrayList<>();
        if (resp == null || !(resp.get("result") instanceof Map<?, ?> resultMap)) {
            return devices;
        }
        Map<String, Object> result = (Map<String, Object>) resultMap;
        if (result.get("devices") instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    Map<String, Object> d = (Map<String, Object>) m;
                    devices.add(new TuyaDeviceDto(
                            asString(d.get("id")),
                            asString(d.get("name")),
                            asString(d.get("category")),
                            asString(d.get("product_name")),
                            Boolean.TRUE.equals(d.get("online")),
                            false));
                }
            }
        }
        if (Boolean.TRUE.equals(result.get("has_more"))) {
            log.warn("Tuya: plus de 100 devices associes au projet — pagination non implementee, "
                    + "certains devices ne sont pas listes.");
        }
        return devices;
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }

    /**
     * Recupere les data points actuels d'un device.
     * GET /v1.0/devices/{device_id}/status
     * Le DP 12 ("noise_value") contient le niveau de bruit en dB.
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceStatus(String deviceId) {
        validateDeviceId(deviceId);
        return doGet("/v1.0/devices/" + deviceId + "/status");
    }

    /**
     * Recupere l'historique des data points d'un device.
     * GET /v2.0/devices/{device_id}/logs?start_time=...&end_time=...&type=7&size=100
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDeviceLogs(String deviceId, long startTime, long endTime) {
        validateDeviceId(deviceId);
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
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> sendCommand(String deviceId, List<Map<String, Object>> commands) {
        validateDeviceId(deviceId);
        Map<String, Object> body = Map.of("commands", commands);
        return doPost("/v1.0/devices/" + deviceId + "/commands", body);
    }

    // ─── Camera (IPC, categorie "sp") — allocation de flux ──────

    /**
     * Alloue une URL de flux temps reel pour une camera Tuya (categorie "sp").
     * POST /v1.0/devices/{device_id}/stream/actions/allocate  body {"type":"RTSP"|"HLS"}
     * Reponse attendue : {@code { "result": { "url": "rtsps://..." } }}.
     * L'URL est a duree de vie limitee cote Tuya -> re-allouer a l'expiration.
     *
     * <p><b>NON VALIDE</b> : implemente d'apres l'API Tuya, non teste faute de camera
     * Tuya physique. A confirmer avec un vrai device avant de s'y fier en prod.
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> allocateStream(String deviceId, String type) {
        validateDeviceId(deviceId);
        Map<String, Object> body = Map.of("type", (type == null || type.isBlank()) ? "RTSP" : type);
        return doPost("/v1.0/devices/" + deviceId + "/stream/actions/allocate", body);
    }

    // ─── Door Lock — Temporary Password ─────────────────────────

    /**
     * Cree un mot de passe temporaire sur une serrure Tuya.
     * POST /v1.0/devices/{device_id}/door-lock/temp-password
     *
     * Genere un code 6 chiffres aleatoire (SecureRandom) et l'enregistre
     * sur le device pour la fenetre de validite donnee.
     *
     * @param deviceId      Tuya external device ID
     * @param effectiveTime Debut de validite (epoch seconds)
     * @param invalidTime   Fin de validite (epoch seconds)
     * @param name          Nom descriptif (ex: "Clenzy-Jean Dupont")
     * @return Reponse Tuya enrichie avec le champ "password" contenant le code genere
     */
    @CircuitBreaker(name = "tuya-api")
    public Map<String, Object> createTemporaryPassword(
            String deviceId, long effectiveTime, long invalidTime, String name
    ) {
        validateDeviceId(deviceId);

        // Genere un code 6 chiffres aleatoire
        String password = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));

        Map<String, Object> body = Map.of(
                "password", password,
                "effective_time", effectiveTime,
                "invalid_time", invalidTime,
                "name", name != null ? name : "Clenzy Guest"
        );

        String path = "/v1.0/devices/" + deviceId + "/door-lock/temp-password";
        Map<String, Object> result = doPost(path, body);

        // Enrichir le resultat avec le code genere (pour le caller)
        Map<String, Object> enrichedResult = new LinkedHashMap<>(result);
        enrichedResult.put("password", password);

        // Capture l'id Tuya du mot de passe (requis pour la revocation ulterieure).
        // Absent sur certains modeles → revocation alors locale uniquement (le code
        // expire de toute facon a invalid_time).
        Object tuyaId = result.get("id");
        if (tuyaId != null) {
            enrichedResult.put("tuyaPasswordId", tuyaId.toString());
        }

        log.info("Mot de passe temporaire Tuya cree pour device={} (validite: {} -> {})",
                deviceId, effectiveTime, invalidTime);

        return enrichedResult;
    }

    /**
     * Revoque un mot de passe temporaire sur une serrure Tuya.
     * DELETE /v1.0/devices/{device_id}/door-lock/temp-passwords/{password_id}
     *
     * @param deviceId   Tuya external device ID
     * @param passwordId identifiant du mot de passe cote Tuya (capture a la creation)
     */
    @CircuitBreaker(name = "tuya-api")
    public Map<String, Object> deleteTemporaryPassword(String deviceId, String passwordId) {
        validateDeviceId(deviceId);
        // Reutilise le pattern device (alphanumerique/-/_) comme garde anti path-traversal.
        if (passwordId == null || !DEVICE_ID_PATTERN.matcher(passwordId).matches()) {
            throw new IllegalArgumentException("Password ID Tuya invalide");
        }
        return doDelete("/v1.0/devices/" + deviceId + "/door-lock/temp-passwords/" + passwordId);
    }

    // ─── Comptes app Tuya par hote (modele C) ───────────────────

    /**
     * Provisionne un compte app Tuya sous le schema du projet (modele C).
     * POST /v1.0/apps/{schema}/user. Le compte est lie au projet plateforme : les appareils que
     * l'hote y appaire (app mobile de marque) deviennent decouvrables par le PMS.
     *
     * <p><b>NON VALIDE</b> : implemente d'apres l'API Tuya, non teste (App SDK pas encore configure).
     * TODO a confirmer avec le vrai App SDK : hachage du password (md5 ?), username_type, country_code.
     */
    @CircuitBreaker(name = "tuya-api")
    @SuppressWarnings("unchecked")
    public Map<String, Object> createAppUser(String username, String password, String countryCode) {
        String schema = config.getAppSchema();
        if (schema == null || schema.isBlank()) {
            throw new IllegalStateException(
                    "Schema App SDK Tuya non configure (tuya_platform_config.app_schema)");
        }
        Map<String, Object> body = Map.of(
                "country_code", countryCode != null && !countryCode.isBlank() ? countryCode : "33",
                "username", username,
                "password", password,
                "username_type", 3 // compte custom (ni email ni telephone verifies)
        );
        return doPost("/v1.0/apps/" + schema + "/user", body);
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> doDelete(String path) {
        String token = getAccessToken();
        String timestamp = String.valueOf(System.currentTimeMillis());
        String nonce = UUID.randomUUID().toString();

        // Body vide pour un DELETE → meme hash de contenu qu'un GET.
        String stringToSign = buildStringToSign("DELETE", path, "", null);
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
                    HttpMethod.DELETE,
                    new HttpEntity<>(headers),
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
            log.error("Erreur API Tuya DELETE {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Tuya", e);
        }
    }
}
