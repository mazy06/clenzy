package com.clenzy.integration.homeaway.controller;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.service.HomeAwayConnectionQueryService;
import com.clenzy.integration.homeaway.service.HomeAwaySyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

/**
 * Controller pour les webhooks HomeAway/Abritel.
 *
 * Endpoint public (pas d'authentification JWT) car HomeAway envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header
 * - Rate limiting au niveau Nginx
 *
 * Un 2xx atteste un traitement terminé. Les chemins PMS non implémentés restent en 503.
 */
@RestController
@PreAuthorize("permitAll()")
@RequestMapping("/api/webhooks/homeaway")
@Tag(name = "HomeAway Webhooks", description = "Reception des evenements HomeAway/Abritel")
public class HomeAwayWebhookController {

    private static final Logger log = LoggerFactory.getLogger(HomeAwayWebhookController.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final HomeAwayConfig config;
    private final HomeAwayConnectionQueryService connectionQueryService;
    private final HomeAwaySyncService syncService;

    public HomeAwayWebhookController(HomeAwayConfig config,
                                     HomeAwayConnectionQueryService connectionQueryService,
                                     HomeAwaySyncService syncService) {
        this.config = config;
        this.connectionQueryService = connectionQueryService;
        this.syncService = syncService;
    }

    /**
     * Endpoint webhook HomeAway.
     * Recoit les evenements (reservations, disponibilite, listings).
     *
     * Header attendu : X-HomeAway-Signature (HMAC-SHA256 du body)
     */
    @PostMapping
    @Operation(summary = "Webhook HomeAway",
            description = "Recoit les evenements HomeAway (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-HomeAway-Signature", required = false) String signature) {

        log.debug("Webhook HomeAway recu ({} bytes)", payload != null ? payload.length() : 0);

        // Signature OBLIGATOIRE — fail-closed.
        //
        // La validation etait conditionnee a la presence du secret : sans
        // secret configure, elle etait purement et simplement SAUTEE et le
        // payload traite. La route etant desormais publique (elle doit l'etre,
        // HomeAway appelle sans jeton), ce repli aurait laisse n'importe qui
        // injecter des evenements de reservation. Un secret absent est une
        // erreur de deploiement, pas une permission.
        //
        // Meme regime que les webhooks Airbnb, Booking.com et TripAdvisor.
        if (config.getWebhookSecret() == null || config.getWebhookSecret().isBlank()) {
            log.error("HOMEAWAY_WEBHOOK_SECRET non configure — webhook rejete par securite");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "error",
                    "message", "Webhook signature verification not configured"
            ));
        }
        if (!verifySignature(payload, signature)) {
            log.warn("Signature webhook HomeAway invalide");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "status", "error",
                    "message", "Invalid signature"
            ));
        }

        if (payload.length() > 1_048_576) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("status", "error", "message", "Payload too large"));
        }
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var event = mapper.readTree(payload);
            if (event == null || !event.isObject() || !event.path("event_type").isTextual()
                    || event.path("event_type").asText().isBlank() || !event.path("data").isObject()
                    || !event.path("data").path("listing_id").isTextual()
                    || event.path("data").path("listing_id").asText().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Invalid event structure"));
            }
            String eventType = event.path("event_type").asText();
            String listingId = event.path("data").path("listing_id").asText();
            Long orgId = connectionQueryService.resolveOrganizationId(listingId);
            if (orgId == null) return unavailable();
            Map<String, Object> data = mapper.convertValue(event.path("data"), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            switch (eventType) {
                case "reservation.created" -> syncService.handleReservationCreated(data, orgId);
                case "reservation.updated" -> syncService.handleReservationUpdated(data, orgId);
                case "reservation.cancelled" -> syncService.handleReservationCancelled(data, orgId);
                case "availability.updated" -> syncService.handleAvailabilityUpdate(data, orgId);
                default -> {return unavailable();}
            }
            return ResponseEntity.ok(Map.of("status", "ok", "message", "Event processed"));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Invalid JSON"));
        } catch (Exception ignored) {
            log.error("Traitement du webhook HomeAway indisponible");
            return unavailable();
        }
    }

    private ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", "error", "message", "Event processing unavailable"));
    }

    /**
     * Verifie la signature HMAC-SHA256 du webhook.
     */
    private boolean verifySignature(String payload, String signature) {
        if (signature == null || !signature.matches("[A-Fa-f0-9]{64}") || payload == null) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKey = new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
            mac.init(secretKey);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = HexFormat.of().formatHex(hash);
            // Comparaison constant-time pour eviter une timing attack sur la signature.
            return MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    signature.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Vérification de signature HomeAway indisponible");
            return false;
        }
    }
}
