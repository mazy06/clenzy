package com.clenzy.controller;

import com.clenzy.dto.OpsAlertRequest;
import com.clenzy.model.NotificationKey;
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

    private final NotificationService notificationService;
    private final String opsToken;

    public OpsAlertController(NotificationService notificationService,
                              @Value("${clenzy.ops.alert-token:}") String opsToken) {
        this.notificationService = notificationService;
        this.opsToken = opsToken;
    }

    @PostMapping
    @Operation(summary = "Recevoir une alerte ops",
            description = "Cree une notification in-app pour le staff plateforme. Header X-Ops-Token requis.")
    public ResponseEntity<?> receive(@RequestBody(required = false) OpsAlertRequest req,
                                     @RequestHeader(value = "X-Ops-Token", required = false) String token) {
        if (!tokenValid(token)) {
            log.warn("Alerte ops rejetee : token absent ou invalide (source={})",
                    req != null ? req.source() : null);
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

        notificationService.notifyAllPlatformStaff(
                NotificationKey.OPS_ALERT,
                StringUtils.escapeHtml(rawTitle),
                StringUtils.escapeHtml(rawMessage),
                actionUrl);

        log.info("Alerte ops -> notif plateforme : source={} severity={} title='{}'",
                req.source(), req.severity(), rawTitle);
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
        if (payload == null || !payload.hasNonNull("alerts") || !payload.get("alerts").isArray()) {
            return ResponseEntity.badRequest().body(Map.of("error", "alerts_required"));
        }

        String status = payload.path("status").asText("firing");
        List<String> names = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        for (JsonNode alert : payload.get("alerts")) {
            String name = alert.path("labels").path("alertname").asText("alert");
            String severity = alert.path("labels").path("severity").asText("");
            String summary = alert.path("annotations").path("summary").asText("");
            String desc = alert.path("annotations").path("description").asText("");
            names.add(name);
            String detail = !summary.isBlank() ? summary : desc;
            lines.add("• " + name + (severity.isBlank() ? "" : " [" + severity + "]")
                    + (detail.isBlank() ? "" : " — " + detail));
        }
        String distinctNames = String.join(", ", names.stream().distinct().toList());
        String title = truncate("[" + status + "] " + distinctNames, MAX_TITLE);
        String message = truncate(String.join("\n", lines), MAX_MESSAGE);

        notificationService.notifyAllPlatformStaff(
                NotificationKey.OPS_ALERT,
                StringUtils.escapeHtml(title),
                StringUtils.escapeHtml(message),
                null);

        log.info("Webhook Alertmanager -> notif plateforme : status={} alerts={}", status, names.size());
        return ResponseEntity.accepted().body(Map.of("status", "notified", "alerts", names.size()));
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
