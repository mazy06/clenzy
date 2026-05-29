package com.clenzy.controller;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.tenant.TenantContext;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints frontend pour le flow de scan QR OpenWA (Phase 4b). Ces endpoints
 * sont des PROXY signes vers l'instance OpenWA partagee (cf. clenzy-infra
 * docker-compose service `openwa`, port 2785 interne).
 *
 * <h3>Pourquoi un proxy</h3>
 * Le frontend ne doit JAMAIS appeler directement OpenWA :
 * <ul>
 *   <li>OpenWA est sur le reseau Docker interne (pas expose externe en prod)</li>
 *   <li>L'API_MASTER_KEY ne doit pas etre embarquee cote browser</li>
 *   <li>Le scoping per-org est fait ici (chaque org a sa propre session)</li>
 * </ul>
 *
 * <h3>Flow scan QR</h3>
 * <ol>
 *   <li><b>POST /api/whatsapp/openwa/session</b> : cree une session sur OpenWA
 *       (ID = owa-org-{orgId}-{uuid8}), genere une API key per-session, persist
 *       sessionId + chiffre la apiKey dans whatsapp_configs, retourne au frontend
 *       les credentials qu'il pourra renseigner dans le form.</li>
 *   <li><b>GET /api/whatsapp/openwa/qr</b> : recupere l'image QR base64 depuis
 *       OpenWA (instance partagee) pour la session de l'org courante. Le
 *       frontend l'affiche dans un Dialog modal.</li>
 *   <li><b>GET /api/whatsapp/openwa/status</b> : polling toutes les 2s cote
 *       frontend pour detecter quand l'user a scanne le QR. Retourne
 *       {@code "qr_pending" | "connected" | "disconnected" | "failed"}.</li>
 * </ol>
 *
 * <h3>Securite</h3>
 * Tous les endpoints exigent {@code @PreAuthorize("isAuthenticated()")} et
 * resolvent l'org via {@link TenantContext} — pas de cross-tenant possible.
 */
@RestController
@RequestMapping("/api/whatsapp/openwa")
@PreAuthorize("isAuthenticated()")
public class OpenWaSessionController {

    private static final Logger log = LoggerFactory.getLogger(OpenWaSessionController.class);

    private final WhatsAppConfigRepository configRepository;
    private final TenantContext tenantContext;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String openwaBaseUrl;
    private final String openwaMasterKey;

    public OpenWaSessionController(
            WhatsAppConfigRepository configRepository,
            TenantContext tenantContext,
            ObjectMapper objectMapper,
            @Value("${clenzy.whatsapp.openwa.base-url:http://openwa:2785}") String openwaBaseUrl,
            @Value("${OPENWA_API_MASTER_KEY:}") String openwaMasterKey) {
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        this.openwaBaseUrl = openwaBaseUrl;
        this.openwaMasterKey = openwaMasterKey;
    }

    // ─── POST /session : provisionne une session OpenWA pour l'org ─────────

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession() {
        ensureMasterKey();
        Long orgId = tenantContext.getRequiredOrganizationId();

        // ID de session deterministe par-org + suffix UUID pour eviter les
        // collisions si l'user reset plusieurs fois (l'ancienne session
        // restera en base OpenWA, c'est OK — orphan cleanup possible plus tard).
        String sessionId = "owa-org-" + orgId + "-" + UUID.randomUUID().toString().substring(0, 8);
        // API key per-session : 32 bytes hex. Stockee chiffree dans whatsapp_configs.
        String apiKey = "owa_" + UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "").substring(0, 4);

        // Crée la session sur l'instance OpenWA (auth par API_MASTER_KEY)
        try {
            String url = openwaBaseUrl + "/api/sessions";
            Map<String, Object> body = Map.of(
                "sessionId", sessionId,
                "apiKey", apiKey
            );
            restTemplate.exchange(url, HttpMethod.POST, withMasterKey(body), String.class);
        } catch (Exception e) {
            log.error("Echec creation session OpenWA pour org {}: {}", orgId, e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                "error", "Instance OpenWA injoignable",
                "details", "Verifier que le container openwa est demarre (docker compose --profile openwa up -d)"));
        }

        // Persiste les credentials sur l'entite WhatsAppConfig de l'org
        WhatsAppConfig config = configRepository.findByOrganizationId(orgId)
            .orElseGet(() -> {
                WhatsAppConfig c = new WhatsAppConfig();
                c.setOrganizationId(orgId);
                return c;
            });
        config.setProvider(WhatsAppProviderType.OPENWA);
        config.setOpenwaSessionId(sessionId);
        config.setOpenwaApiKey(apiKey); // Setter encode automatiquement via converter Jasypt
        configRepository.save(config);

        log.info("Session OpenWA cree pour org {}: {}", orgId, sessionId);
        return ResponseEntity.ok(Map.of(
            "sessionId", sessionId,
            "status", "qr_pending"
        ));
    }

    // ─── GET /qr : recupere l'image QR depuis OpenWA ───────────────────────

    @GetMapping("/qr")
    public ResponseEntity<Map<String, Object>> getQr() {
        ensureMasterKey();
        Long orgId = tenantContext.getRequiredOrganizationId();

        WhatsAppConfig config = configRepository.findByOrganizationId(orgId)
            .orElseThrow(() -> new AccessDeniedException("Pas de config WhatsApp pour cette organisation"));

        if (config.getOpenwaSessionId() == null) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "Aucune session OpenWA active. Cliquez sur 'Scanner le QR code' pour en creer une."));
        }

        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/qr";
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, withSessionAuth(config), String.class);

            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                // OpenWA renvoie { "qr": "data:image/png;base64,..." } ou { "qrCode": "..." }
                String qr = root.path("qr").asText(root.path("qrCode").asText(""));
                if (qr.isBlank()) {
                    return ResponseEntity.status(404).body(Map.of(
                        "error", "QR code non disponible (session deja connectee ?)"));
                }
                return ResponseEntity.ok(Map.of("qr", qr, "sessionId", config.getOpenwaSessionId()));
            }
        } catch (Exception e) {
            log.warn("Erreur recuperation QR OpenWA pour org {}: {}", orgId, e.getMessage());
        }
        return ResponseEntity.status(503).body(Map.of("error", "Instance OpenWA injoignable ou session expiree"));
    }

    // ─── GET /status : polling du status connexion ─────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        ensureMasterKey();
        Long orgId = tenantContext.getRequiredOrganizationId();

        WhatsAppConfig config = configRepository.findByOrganizationId(orgId).orElse(null);
        if (config == null || config.getOpenwaSessionId() == null) {
            return ResponseEntity.ok(Map.of("status", "not_configured"));
        }

        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/status";
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, withSessionAuth(config), String.class);

            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String status = root.path("status").asText("unknown");
                // OpenWA peut renvoyer : QR / CONNECTED / DISCONNECTED / FAILED
                // On normalise vers les valeurs attendues par le frontend
                Map<String, Object> result = new HashMap<>();
                result.put("status", normalizeStatus(status));
                result.put("sessionId", config.getOpenwaSessionId());
                if (root.has("phoneNumber")) result.put("phoneNumber", root.path("phoneNumber").asText());
                return ResponseEntity.ok(result);
            }
        } catch (Exception e) {
            log.debug("Erreur polling status OpenWA pour org {}: {}", orgId, e.getMessage());
        }
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }

    // ─── DELETE /session : detruit la session OpenWA + reset config ────────

    @DeleteMapping("/session")
    public ResponseEntity<Void> deleteSession() {
        ensureMasterKey();
        Long orgId = tenantContext.getRequiredOrganizationId();
        WhatsAppConfig config = configRepository.findByOrganizationId(orgId).orElse(null);
        if (config == null || config.getOpenwaSessionId() == null) {
            return ResponseEntity.noContent().build();
        }

        // Best-effort : delete cote OpenWA, mais on continue meme si OpenWA est down
        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId();
            restTemplate.exchange(url, HttpMethod.DELETE, withSessionAuth(config), String.class);
        } catch (Exception e) {
            log.warn("Echec delete session OpenWA pour org {}: {}", orgId, e.getMessage());
        }

        config.setOpenwaSessionId(null);
        config.setOpenwaApiKey(null);
        configRepository.save(config);
        return ResponseEntity.noContent().build();
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * Garantit que OPENWA_API_MASTER_KEY est configure (sinon les calls
     * admin a OpenWA echouent). Retourne 503 explicite a l'user au lieu
     * d'un 500 cryptique.
     */
    private void ensureMasterKey() {
        if (openwaMasterKey == null || openwaMasterKey.isBlank()) {
            throw new IllegalStateException(
                "OPENWA_API_MASTER_KEY non configuree cote serveur. " +
                "Lancer ./scripts/setup-openwa.sh dans clenzy-infra pour la generer.");
        }
    }

    private HttpEntity<Map<String, Object>> withMasterKey(Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", openwaMasterKey);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<Void> withSessionAuth(WhatsAppConfig config) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", config.getOpenwaApiKey());
        return new HttpEntity<>(headers);
    }

    private String normalizeStatus(String openwaStatus) {
        if (openwaStatus == null) return "disconnected";
        return switch (openwaStatus.toUpperCase()) {
            case "QR", "QR_PENDING", "QRCODE", "SCAN_QR_CODE" -> "qr_pending";
            case "CONNECTED", "AUTHENTICATED", "READY" -> "connected";
            case "FAILED", "AUTH_FAILURE" -> "failed";
            default -> "disconnected";
        };
    }
}
