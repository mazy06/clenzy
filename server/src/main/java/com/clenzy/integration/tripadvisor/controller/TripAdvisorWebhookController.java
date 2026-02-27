package com.clenzy.integration.tripadvisor.controller;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import com.clenzy.integration.tripadvisor.service.TripAdvisorSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

/**
 * Controller pour les webhooks TripAdvisor Vacation Rentals.
 *
 * Endpoint public (pas d'authentification JWT) car TripAdvisor envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header X-TripAdvisor-Signature
 * - Rate limiting au niveau Nginx
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible pour eviter
 * les retries de TripAdvisor.
 */
@RestController
@RequestMapping("/api/webhooks")
@Tag(name = "TripAdvisor Webhooks", description = "Reception des evenements TripAdvisor Vacation Rentals")
public class TripAdvisorWebhookController {

    private static final Logger log = LoggerFactory.getLogger(TripAdvisorWebhookController.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final TripAdvisorConfig config;
    private final TripAdvisorSyncService syncService;
    private final TripAdvisorConnectionRepository connectionRepository;

    public TripAdvisorWebhookController(TripAdvisorConfig config,
                                         TripAdvisorSyncService syncService,
                                         TripAdvisorConnectionRepository connectionRepository) {
        this.config = config;
        this.syncService = syncService;
        this.connectionRepository = connectionRepository;
    }

    /**
     * Endpoint webhook TripAdvisor.
     * Recoit les notifications de reservations (created, modified, cancelled).
     *
     * Header attendu : X-TripAdvisor-Signature (HMAC-SHA256 du body)
     */
    @PostMapping("/tripadvisor")
    @Operation(summary = "Webhook TripAdvisor",
            description = "Recoit les evenements TripAdvisor Vacation Rentals (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-TripAdvisor-Signature", required = false) String signature) {

        log.debug("Webhook TripAdvisor recu ({} bytes)", payload != null ? payload.length() : 0);

        if (payload == null || payload.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Empty payload"
            ));
        }

        // Valider la signature HMAC
        if (!verifySignature(payload, signature)) {
            log.warn("Signature TripAdvisor invalide, webhook rejete");
            return ResponseEntity.status(401).body(Map.of(
                    "status", "error",
                    "message", "Invalid signature"
            ));
        }

        try {
            // Parser le payload minimal pour extraire le type et le partner_id
            @SuppressWarnings("unchecked")
            Map<String, Object> webhookData = parsePayload(payload);
            if (webhookData == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Invalid payload format"
                ));
            }

            String eventType = (String) webhookData.get("event_type");
            String partnerId = (String) webhookData.get("partner_id");

            if (eventType == null || partnerId == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Missing event_type or partner_id"
                ));
            }

            // Resoudre l'organisation via le partner_id
            Optional<TripAdvisorConnection> connectionOpt =
                    connectionRepository.findByPartnerId(partnerId);

            if (connectionOpt.isEmpty()) {
                log.warn("Webhook TripAdvisor: partner_id {} non trouve", partnerId);
                return ResponseEntity.ok(Map.of(
                        "status", "ok",
                        "message", "Partner not found, event ignored"
                ));
            }

            Long orgId = connectionOpt.get().getOrganizationId();

            // Traiter l'evenement
            syncService.handleBookingWebhook(eventType, webhookData, orgId);

            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received"
            ));

        } catch (Exception e) {
            log.error("Erreur traitement webhook TripAdvisor: {}", e.getMessage(), e);
            // Repondre 200 pour eviter les retries, l'erreur est loggee
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received with processing error"
            ));
        }
    }

    /**
     * Verifie la signature HMAC-SHA256 du payload webhook.
     */
    private boolean verifySignature(String payload, String signature) {
        if (signature == null || signature.isBlank()) {
            log.warn("Signature TripAdvisor absente");
            return false;
        }

        String secret = config.getApiSecret();
        if (secret == null || secret.isEmpty()) {
            log.warn("API secret TripAdvisor non configure, signature non verifiable");
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = HexFormat.of().formatHex(hash);
            return expectedSignature.equalsIgnoreCase(signature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("Erreur verification signature TripAdvisor: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Parse le payload JSON du webhook.
     * Utilise un parsing minimal pour eviter de dependre d'un ObjectMapper specifique.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayload(String payload) {
        try {
            // Spring Boot auto-configure un ObjectMapper, on delegue la deserialization
            // au framework via @RequestBody Map dans une future version.
            // Pour l'instant, le payload est recu comme String pour validation HMAC,
            // puis on reutilise le parsing minimal.
            var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.readValue(payload, Map.class);
        } catch (Exception e) {
            log.warn("Erreur parsing payload webhook TripAdvisor: {}", e.getMessage());
            return null;
        }
    }
}
