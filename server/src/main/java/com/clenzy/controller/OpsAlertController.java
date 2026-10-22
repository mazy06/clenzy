package com.clenzy.controller;

import com.clenzy.dto.OpsAlertRequest;
import com.clenzy.service.NotificationService;
import com.clenzy.util.StringUtils;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Reception des alertes ops (deploiement echoue, incident infra/monitoring) emises
 * par le CI/CD (cd-deploy.yml) ou Alertmanager. Cree une notification in-app pour
 * tous les SUPER_ADMIN / SUPER_MANAGER de la plateforme (categorie Systeme).
 * <p>
 * Endpoint public (pas de JWT) — la securite repose sur un token partage valide en
 * interne (header {@code X-Ops-Token}), <b>fail-closed</b> : si le token n'est pas
 * configure cote serveur ou ne correspond pas, l'appel est rejete (401). Meme
 * pattern que les controllers webhooks (permitAll + verification interne).
 * <p>
 * Mobile : raison d'etre = ne plus jamais rester aveugle sur un echec de
 * deploiement silencieux (incident 2026-06 : CD Deploy casse pendant plusieurs
 * jours, backend fige, generation des devis en echec).
 */
@RestController
@RequestMapping("/api/ops/alerts")
@PreAuthorize("permitAll()")
@Tag(name = "Ops Alerts", description = "Alertes ops/monitoring -> notification in-app (token partage)")
public class OpsAlertController {

    private static final Logger log = LoggerFactory.getLogger(OpsAlertController.class);

    private static final int MAX_TITLE = 200;
    private static final int MAX_MESSAGE = 2000;
    private static final Set<String> KNOWN_ALERTS = Set.of("ClenzyDeployFailed", "ClenzyDeployStale",
            "ClenzyBackendDown", "ClenzyDocGenFailures", "BaitlyBackendHigh5xx", "BaitlyBackendSlow",
            "BaitlyDatabasePoolSaturated", "BaitlyJvmHeapPressure", "BaitlyBackendDiskLow",
            "BaitlyOperationalMetricsUnavailable", "BaitlyOperationalMetricsStale", "BaitlyOutboxExhausted",
            "BaitlyOutboxStalled", "BaitlyWebhookDeliveryStalled", "BaitlyWebhookDisabled", "BaitlyChannelSyncFailures");

    private final NotificationService notificationService;
    private final String opsToken;
    private final MeterRegistry registry;

    public OpsAlertController(NotificationService notificationService,
                              @Value("${clenzy.ops.alert-token:}") String opsToken,
                              MeterRegistry registry) {
        this.notificationService = notificationService;
        this.opsToken = opsToken;
        this.registry = registry;
    }

    @PostMapping
    @Operation(summary = "Recevoir une alerte ops",
            description = "Cree une notification in-app pour le staff plateforme. Header X-Ops-Token requis.")
    public ResponseEntity<?> receive(@RequestBody(required = false) OpsAlertRequest req,
                                     @RequestHeader(value = "X-Ops-Token", required = false) String token) {
        if (!tokenValid(token)) {
            log.warn("Alerte ops rejetee : token absent ou invalide");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid_token"));
        }
        if (req == null || isBlank(req.title()) || isBlank(req.message())) {
            return ResponseEntity.badRequest().body(Map.of("error", "title_and_message_required"));
        }

        String rawTitle = truncate(req.title(), MAX_TITLE);
        String rawMessage = truncate(req.message(), MAX_MESSAGE);
        // Lien externe (URL du run CI) -> dans le corps (la navigation in-app ne gere
        // que les chemins internes). Un chemin interne ("/...") devient l'actionUrl cliquable.
        String link = isBlank(req.link()) ? null : req.link().trim();
        if (link != null && !link.startsWith("/")) {
            rawMessage = rawMessage + "\n" + link;
        }
        String actionUrl = (link != null && link.startsWith("/")) ? link : null;

        if (!notifyStrict("ci",
                StringUtils.escapeHtml(rawTitle),
                StringUtils.escapeHtml(rawMessage),
                actionUrl)) return notificationUnavailable();

        received("ci", "firing");
        log.info("Baitly ops alert accepted for platform notification");
        return ResponseEntity.accepted().body(Map.of("status", "notified"));
    }

    /**
     * Variante au format webhook Alertmanager. Alertmanager envoie son propre JSON
     * ({@code {status, alerts:[{labels:{alertname,severity}, annotations:{summary,description}}]}})
     * et s'authentifie via {@code Authorization: Bearer <token>} (http_config). On accepte
     * aussi {@code X-Ops-Token} pour homogeneite. Construit une notification in-app synthetique.
     */
    @PostMapping("/alertmanager")
    @Operation(summary = "Recevoir un webhook Alertmanager",
            description = "Route les alertes Prometheus vers une notification in-app. Bearer token requis.")
    public ResponseEntity<?> receiveAlertmanager(
            @RequestBody(required = false) JsonNode payload,
            @RequestHeader(value = "X-Ops-Token", required = false) String headerToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = headerToken;
        if (isBlank(token) && authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = authHeader.substring(7).trim();
        }
        if (!tokenValid(token)) {
            log.warn("Webhook Alertmanager rejete : token absent ou invalide");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid_token"));
        }
        if (payload == null || !payload.hasNonNull("alerts") || !payload.get("alerts").isArray()
                || payload.get("alerts").isEmpty() || payload.get("alerts").size() > 50) {
            return ResponseEntity.badRequest().body(Map.of("error", "alerts_required"));
        }

        String status = payload.path("status").asText("firing");
        if (!Set.of("firing", "resolved").contains(status)) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_status"));
        }
        List<String> names = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        for (JsonNode alert : payload.get("alerts")) {
            String candidate = alert.path("labels").path("alertname").asText("");
            String name = KNOWN_ALERTS.contains(candidate) ? candidate : "MonitoringAlert";
            String severity = alert.path("labels").path("severity").asText("");
            if (!Set.of("critical", "warning", "info").contains(severity)) severity = "warning";
            names.add(name);
            // Remote annotations and labels may contain URLs, identities or secrets.
            // The controlled rule name identifies the runbook; details stay in internal monitoring.
            lines.add(name + " [" + severity + "] : consulter le monitoring interne et le guide d’incident.");
        }
        String distinctNames = String.join(", ", names.stream().distinct().toList());
        String title = truncate("[" + status + "] " + distinctNames, MAX_TITLE);
        String message = truncate(String.join("\n", lines), MAX_MESSAGE);

        if (!notifyStrict("alertmanager",
                StringUtils.escapeHtml(title),
                StringUtils.escapeHtml(message),
                null)) return notificationUnavailable();

        received("alertmanager", status);
        log.info("Webhook Alertmanager -> notif plateforme : status={} alerts={}", status, names.size());
        return ResponseEntity.accepted().body(Map.of("status", "notified", "alerts", names.size()));
    }

    private void received(String source, String status) {
        Counter.builder("baitly.ops.alerts.received").tags("source", source, "status", status)
                .description("Baitly operational alert batches accepted for platform notification")
                .register(registry).increment();
    }

    private boolean notifyStrict(String source, String title, String message, String actionUrl) {
        try {
            if (notificationService.notifyPlatformOpsStrict(title, message, actionUrl) > 0) return true;
        } catch (RuntimeException failure) {
            // Storage errors can contain identities, SQL or credentials. No free text in logs/metrics.
        }
        Counter.builder("baitly.ops.alerts.rejected").tags("source", source, "reason", "notification_unavailable")
                .description("Baitly operational alert batches requiring sender retry")
                .register(registry).increment();
        log.warn("Baitly operational notification unavailable; sender must retry");
        return false;
    }

    private ResponseEntity<?> notificationUnavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "notification_unavailable"));
    }

    /** Comparaison constante-temps ; fail-closed si le token serveur n'est pas configure. */
    private boolean tokenValid(String provided) {
        if (opsToken == null || opsToken.isBlank()) return false; // fail-closed
        if (provided == null || provided.isBlank()) return false;
        return MessageDigest.isEqual(
                opsToken.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
