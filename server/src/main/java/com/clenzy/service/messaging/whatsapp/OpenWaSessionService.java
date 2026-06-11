package com.clenzy.service.messaging.whatsapp;

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
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cycle de vie de la session OpenWA globale (proxy signe vers l'instance
 * OpenWA — cf. clenzy-infra/openwa, NestJS + whatsapp-web.js). Logique
 * deplacee depuis {@code OpenWaSessionController} (refactor T-ARCH-01 —
 * controller mince).
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
 * <h3>Transactions</h3>
 * Volontairement PAS de {@code @Transactional} : chaque methode enchaine des
 * appels HTTP externes (OpenWA) et des sauvegardes ponctuelles — jamais
 * d'appel HTTP dans une transaction DB (regle audit n°2). Les
 * {@code configRepository.save(...)} restent des transactions courtes
 * implicites de Spring Data.
 */
@Service
public class OpenWaSessionService {

    private static final Logger log = LoggerFactory.getLogger(OpenWaSessionService.class);

    /** Nom de la session OpenWA unique (compte WhatsApp global). 3-50 chars, alphanum + tirets. */
    private static final String SESSION_NAME = "clenzy-global";

    private final WhatsAppConfigRepository configRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String openwaBaseUrl;
    private final String webhookUrl;

    public OpenWaSessionService(
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

    /** Issue de la creation/demarrage de la session globale. */
    public record SessionCreation(Outcome outcome, String sessionId) {
        public enum Outcome { MISSING_MASTER_KEY, UNREACHABLE, READY }
    }

    /** Issue de la recuperation du QR code. */
    public record QrFetch(Outcome outcome, String qr, String sessionId) {
        public enum Outcome { NOT_CONFIGURED, NOT_AVAILABLE, UNREACHABLE, OK }
    }

    /** Statut de connexion normalise ({@code sessionId}/{@code phoneNumber} optionnels). */
    public record ConnectionStatus(String status, String sessionId, String phoneNumber) {}

    // ─── Creation (ou reutilisation) + demarrage de la session OpenWA ──────

    public SessionCreation createSession() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        String masterKey = (config != null) ? config.getOpenwaApiKey() : null;
        if (masterKey == null || masterKey.isBlank()) {
            return new SessionCreation(SessionCreation.Outcome.MISSING_MASTER_KEY, null);
        }

        String sessionId = config.getOpenwaSessionId();
        try {
            if (sessionId == null || sessionId.isBlank()) {
                sessionId = createOrFindSession(masterKey);
            }
            startSession(masterKey, sessionId);
        } catch (Exception e) {
            log.error("Echec creation/demarrage session OpenWA: {}", e.getMessage());
            return new SessionCreation(SessionCreation.Outcome.UNREACHABLE, null);
        }

        config.setProvider(WhatsAppProviderType.OPENWA);
        config.setOpenwaSessionId(sessionId);
        ensureWebhook(masterKey, sessionId, config); // genere+persiste le secret HMAC + enregistre le webhook entrant (best-effort)
        configRepository.save(config);

        log.info("Session OpenWA globale prête: {}", sessionId);
        return new SessionCreation(SessionCreation.Outcome.READY, sessionId);
    }

    // ─── Recuperation de l'image QR depuis OpenWA ──────────────────────────

    public QrFetch fetchQr() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId()) || isBlank(config.getOpenwaApiKey())) {
            return new QrFetch(QrFetch.Outcome.NOT_CONFIGURED, null, null);
        }
        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/qr";
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, auth(config.getOpenwaApiKey(), null), String.class);
            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String qr = root.path("qrCode").asText(root.path("qr").asText(""));
                if (qr.isBlank()) {
                    return new QrFetch(QrFetch.Outcome.NOT_AVAILABLE, null, null);
                }
                return new QrFetch(QrFetch.Outcome.OK, qr, config.getOpenwaSessionId());
            }
        } catch (Exception e) {
            log.warn("Erreur recuperation QR OpenWA: {}", e.getMessage());
        }
        return new QrFetch(QrFetch.Outcome.UNREACHABLE, null, null);
    }

    // ─── Polling du statut de connexion ────────────────────────────────────

    public ConnectionStatus fetchStatus() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId()) || isBlank(config.getOpenwaApiKey())) {
            return new ConnectionStatus("not_configured", null, null);
        }
        try {
            String url = openwaBaseUrl + "/api/sessions/" + config.getOpenwaSessionId();
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, auth(config.getOpenwaApiKey(), null), String.class);
            if (response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String phoneNumber = root.has("phone") ? root.path("phone").asText() : null;
                return new ConnectionStatus(
                    normalizeStatus(root.path("status").asText("unknown")),
                    config.getOpenwaSessionId(),
                    phoneNumber);
            }
        } catch (Exception e) {
            log.debug("Erreur polling status OpenWA: {}", e.getMessage());
        }
        return new ConnectionStatus("disconnected", null, null);
    }

    // ─── Destruction de la session OpenWA + reset de l'id ──────────────────

    public void deleteSession() {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null || isBlank(config.getOpenwaSessionId())) {
            return;
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
