package com.clenzy.integration.homeaway.controller;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.homeaway.service.HomeAwaySyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

/**
 * Controller pour les webhooks HomeAway/Abritel.
 *
 * Endpoint public (pas d'authentification JWT) car HomeAway envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header
 * - Rate limiting au niveau Nginx
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible (< 5s)
 * pour eviter les retries de HomeAway.
 */
@RestController
@RequestMapping("/api/webhooks/homeaway")
@Tag(name = "HomeAway Webhooks", description = "Reception des evenements HomeAway/Abritel")
public class HomeAwayWebhookController {

    private static final Logger log = LoggerFactory.getLogger(HomeAwayWebhookController.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final HomeAwayConfig config;
    private final HomeAwayConnectionRepository connectionRepository;
    private final HomeAwaySyncService syncService;

    public HomeAwayWebhookController(HomeAwayConfig config,
                                     HomeAwayConnectionRepository connectionRepository,
                                     HomeAwaySyncService syncService) {
        this.config = config;
        this.connectionRepository = connectionRepository;
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

        // Valider la signature si le secret est configure
        if (config.getWebhookSecret() != null && !config.getWebhookSecret().isEmpty()) {
            if (!verifySignature(payload, signature)) {
                log.warn("Signature webhook HomeAway invalide");
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Invalid signature"
                ));
            }
        }

        try {
            // Parser le payload et router vers le bon handler
            @SuppressWarnings("unchecked")
            Map<String, Object> event = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(payload, Map.class);

            String eventType = (String) event.get("event_type");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            String listingId = data != null ? (String) data.get("listing_id") : null;

            if (eventType == null || data == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Missing event_type or data"
                ));
            }

            // Resoudre l'orgId depuis le listing
            Long orgId = resolveOrganizationId(listingId);
            if (orgId == null) {
                log.warn("Listing HomeAway {} non liee, webhook ignore", listingId);
                return ResponseEntity.ok(Map.of(
                        "status", "ok",
                        "message", "Listing not linked, event ignored"
                ));
            }

            // Router l'evenement
            switch (eventType) {
                case "reservation.created" -> syncService.handleReservationCreated(data, orgId);
                case "reservation.updated" -> syncService.handleReservationUpdated(data, orgId);
                case "reservation.cancelled" -> syncService.handleReservationCancelled(data, orgId);
                case "availability.updated" -> syncService.handleAvailabilityUpdate(data, orgId);
                default -> log.warn("Type d'evenement webhook HomeAway inconnu: {}", eventType);
            }

            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received"
            ));

        } catch (Exception e) {
            log.error("Erreur traitement webhook HomeAway: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received (processing failed, will retry)"
            ));
        }
    }

    /**
     * Verifie la signature HMAC-SHA256 du webhook.
     */
    private boolean verifySignature(String payload, String signature) {
        if (signature == null || payload == null) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKey = new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
            mac.init(secretKey);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = HexFormat.of().formatHex(hash);
            return expectedSignature.equalsIgnoreCase(signature);
        } catch (Exception e) {
            log.error("Erreur verification signature webhook HomeAway: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Resout l'organizationId depuis un listing HomeAway.
     */
    private Long resolveOrganizationId(String listingId) {
        if (listingId == null) return null;
        Optional<HomeAwayConnection> connection = connectionRepository.findByListingId(listingId);
        return connection.map(HomeAwayConnection::getOrganizationId).orElse(null);
    }
}
