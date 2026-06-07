package com.clenzy.controller;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints frontend pour le flow de scan QR OpenWA (proxy signe vers l'instance
 * OpenWA — cf. clenzy-infra/openwa, NestJS + whatsapp-web.js).
 *
 * <h3>Compte WhatsApp GLOBAL</h3>
 * Une seule session OpenWA pour toute la plateforme (nom {@code clenzy-global}).
 * La <b>master key</b> OpenWA (rôle ADMIN) est stockée chiffrée en base dans
 * {@link WhatsAppConfig#getOpenwaApiKey()} (saisie depuis l'UI) — plus de
 * variable d'environnement. L'{@code openwaSessionId} stocke l'id (uuid) de la
 * session créée côté OpenWA.
 *
 * <h3>Contrat API OpenWA réel</h3>
 * <ul>
 *   <li>POST /api/sessions {name} → {id, status} (puis POST /sessions/:id/start)</li>
 *   <li>GET  /api/sessions/:id/qr → {qrCode, status}</li>
 *   <li>GET  /api/sessions/:id → {status, phone}</li>
 *   <li>DELETE /api/sessions/:id</li>
 *   <li>Auth : header {@code X-API-Key: <master key>} (rôle ADMIN suffit pour tout)</li>
 * </ul>
 *
 * <h3>Sécurité</h3>
 * Opération PLATEFORME : {@code hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')}.
 */
@RestController
@RequestMapping("/api/whatsapp/openwa")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class OpenWaSessionController {

    private static final Logger log = LoggerFactory.getLogger(OpenWaSessionController.class);

    /** Nom de la session OpenWA unique (compte WhatsApp global). 3-50 chars, alphanum + tirets. */
    private static final String SESSION_NAME = "clenzy-global";

    private final WhatsAppConfigRepository configRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String openwaBaseUrl;
    private final String webhookUrl;

    public OpenWaSessionController(
            WhatsAppConfigRepository configRepository,
            ObjectMapper objectMapper,
            @Value("${clenzy.whatsapp.openwa.base-url:http://openwa:2785}") String openwaBaseUrl,
            @Value("${clenzy.whatsapp.openwa.webhook-url:http://host.docker.internal:8084/api/webhooks/whatsapp/openwa}") String webhookUrl) {
        this.configRepository = configRepository;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        this.openwaBaseUrl = openwaBaseUrl;
        this.webhookUrl = webhookUrl;
    }

    // ─── POST /session : crée (ou réutilise) + démarre la session OpenWA ────

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        String masterKey = (config != null) ? config.getOpenwaApiKey() : null;
        if (masterKey == null || masterKey.isBlank()) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "Master key OpenWA non configurée. Saisissez-la dans la configuration et enregistrez d'abord."));
        }

        String sessionId = config.getOpenwaSessionId();
        try {
            if (sessionId == null || sessionId.isBlank()) {
                sessionId = createOrFindSession(masterKey);
            }
            startSession(masterKey, sessionId);
        } catch (Exception e) {
            log.error("Echec creation/demarrage session OpenWA: {}", e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                "error", "Instance OpenWA injoignable ou master key invalide",
                "details", "Verifier que le container openwa est demarre et la master key correcte."));
        }

        config.setProvider(WhatsAppProviderType.OPENWA);
        config.setOpenwaSessionId(sessionId);
        ensureWebhook(masterKey, sessionId, config); // genere+persiste le secret HMAC + enregistre le webhook entrant (best-effort)
        configRepository.save(config);

        log.info("Session OpenWA globale prête: {}", sessionId);
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "status", "qr_pending"));
    }

    // ─── GET /qr : récupère l'image QR depuis OpenWA ───────────────────────

    @GetMapping("/qr")
    public ResponseEntity<Map<String, Object>> getQr() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId()) || isBlank(config.getOpenwaApiKey())) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "Aucune session OpenWA active. Cliquez sur 'Scanner le QR code'."));
        }
        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/qr";
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, auth(config.getOpenwaApiKey(), null), String.class);
            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String qr = root.path("qrCode").asText(root.path("qr").asText(""));
                if (qr.isBlank()) {
                    return ResponseEntity.status(404).body(Map.of(
                        "error", "QR code non disponible (session déjà connectée ?)"));
                }
                return ResponseEntity.ok(Map.of("qr", qr, "sessionId", config.getOpenwaSessionId()));
            }
        } catch (Exception e) {
            log.warn("Erreur recuperation QR OpenWA: {}", e.getMessage());
        }
        return ResponseEntity.status(503).body(Map.of("error", "Instance OpenWA injoignable ou QR pas prêt"));
    }

    // ─── GET /status : polling du statut de connexion ──────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId()) || isBlank(config.getOpenwaApiKey())) {
            return ResponseEntity.ok(Map.of("status", "not_configured"));
        }
        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId();
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, auth(config.getOpenwaApiKey(), null), String.class);
            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                Map<String, Object> result = new HashMap<>();
                result.put("status", normalizeStatus(root.path("status").asText("unknown")));
                result.put("sessionId", config.getOpenwaSessionId());
                if (root.has("phone")) result.put("phoneNumber", root.path("phone").asText());
                return ResponseEntity.ok(result);
            }
        } catch (Exception e) {
            log.debug("Erreur polling status OpenWA: {}", e.getMessage());
        }
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }

    // ─── DELETE /session : détruit la session OpenWA + reset l'id ──────────

    @DeleteMapping("/session")
    public ResponseEntity<Void> deleteSession() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId())) {
            return ResponseEntity.noContent().build();
        }
        if (!isBlank(config.getOpenwaApiKey())) {
            try {
                String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId();
                restTemplate.exchange(url, HttpMethod.DELETE, auth(config.getOpenwaApiKey(), null), String.class);
            } catch (Exception e) {
                log.warn("Echec delete session OpenWA: {}", e.getMessage());
            }
        }
        config.setOpenwaSessionId(null); // on garde la master key (openwaApiKey)
        configRepository.save(config);
        return ResponseEntity.noContent().build();
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    /** Crée la session {name}; si le nom existe déjà (409), récupère son id. Retourne l'id (uuid). */
    private String createOrFindSession(String masterKey) throws Exception {
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                openwaBaseUrl + "/api/sessions", HttpMethod.POST,
                auth(masterKey, Map.of("name", SESSION_NAME)), String.class);
            return objectMapper.readTree(resp.getBody()).path("id").asText();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().value() == 409) {
                return findSessionIdByName(masterKey, SESSION_NAME);
            }
            throw e;
        }
    }

    private String findSessionIdByName(String masterKey, String name) throws Exception {
        ResponseEntity<String> resp = restTemplate.exchange(
            openwaBaseUrl + "/api/sessions", HttpMethod.GET, auth(masterKey, null), String.class);
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode arr = root.isArray() ? root : root.path("data");
        if (arr.isArray()) {
            for (JsonNode s : arr) {
                if (name.equals(s.path("name").asText())) return s.path("id").asText();
            }
        }
        throw new IllegalStateException("Session OpenWA '" + name + "' introuvable après conflit");
    }

    /** Démarre la session (génère le QR). Non bloquant si déjà démarrée. */
    private void startSession(String masterKey, String sessionId) {
        try {
            restTemplate.exchange(
                openwaBaseUrl + "/api/sessions/" + sessionId + "/start", HttpMethod.POST,
                auth(masterKey, null), String.class);
        } catch (Exception e) {
            log.debug("start session OpenWA (non bloquant): {}", e.getMessage());
        }
    }

    // ─── Webhook entrant (relais guest -> host) ───────────────────────────

    /** Enregistre (idempotent) le webhook entrant cote OpenWA + persiste le secret HMAC en BDD. */
    private void ensureWebhook(String masterKey, String sessionId, WhatsAppConfig config) {
        if (isBlank(webhookUrl)) return;
        try {
            if (isBlank(config.getOpenwaWebhookSecret())) {
                config.setOpenwaWebhookSecret(UUID.randomUUID().toString());
            }
            // OpenWA ne dedoublonne pas : ne pas recreer si l'URL est deja enregistree.
            if (webhookAlreadyRegistered(masterKey, sessionId)) {
                log.debug("Webhook OpenWA deja enregistre pour {}", sessionId);
                return;
            }
            Map<String, Object> body = Map.of(
                "url", webhookUrl,
                "events", List.of("message.received"),
                "secret", config.getOpenwaWebhookSecret());
            restTemplate.exchange(
                openwaBaseUrl + "/api/sessions/" + sessionId + "/webhooks",
                HttpMethod.POST, auth(masterKey, body), String.class);
            log.info("Webhook OpenWA entrant enregistre: {} -> {}", sessionId, webhookUrl);
        } catch (Exception e) {
            log.warn("Echec enregistrement webhook OpenWA (relais entrant indisponible): {}", e.getMessage());
        }
    }

    private boolean webhookAlreadyRegistered(String masterKey, String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                openwaBaseUrl + "/api/sessions/" + sessionId + "/webhooks",
                HttpMethod.GET, auth(masterKey, null), String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode arr = root.isArray() ? root : root.path("data");
            if (arr.isArray()) {
                for (JsonNode w : arr) {
                    if (webhookUrl.equals(w.path("url").asText())) return true;
                }
            }
        } catch (Exception e) {
            log.debug("Liste webhooks OpenWA indisponible: {}", e.getMessage());
        }
        return false;
    }

    private HttpEntity<Object> auth(String masterKey, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", masterKey);
        return new HttpEntity<>(body, headers);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /** Normalise les statuts OpenWA vers les valeurs attendues par le frontend. */
    private String normalizeStatus(String openwaStatus) {
        if (openwaStatus == null) return "disconnected";
        return switch (openwaStatus.toLowerCase()) {
            case "created", "initializing", "qr_ready", "authenticating" -> "qr_pending";
            case "ready", "connected", "authenticated" -> "connected";
            case "failed", "auth_failure" -> "failed";
            default -> "disconnected";
        };
    }
}
