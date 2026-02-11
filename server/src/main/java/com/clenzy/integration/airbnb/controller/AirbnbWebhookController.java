package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.service.AirbnbWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour les webhooks Airbnb.
 *
 * Endpoint public (pas d'authentification JWT) car Airbnb envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header
 * - Deduplication via event_id
 * - Rate limiting au niveau Nginx
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible (< 5s)
 * pour eviter les retries d'Airbnb. Le traitement reel est
 * asynchrone via Kafka.
 */
@RestController
@RequestMapping("/api/webhooks")
@Tag(name = "Airbnb Webhooks", description = "Reception des evenements Airbnb")
public class AirbnbWebhookController {

    private static final Logger log = LoggerFactory.getLogger(AirbnbWebhookController.class);

    private final AirbnbWebhookService webhookService;

    public AirbnbWebhookController(AirbnbWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    /**
     * Endpoint webhook Airbnb.
     * Recoit les evenements (reservations, calendrier, messages, listings).
     *
     * Header attendu : X-Airbnb-Signature (HMAC-SHA256 du body)
     */
    @PostMapping("/airbnb")
    @Operation(summary = "Webhook Airbnb",
            description = "Recoit les evenements Airbnb (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Airbnb-Signature", required = false) String signature) {

        log.debug("Webhook Airbnb recu ({} bytes)", payload != null ? payload.length() : 0);

        boolean accepted = webhookService.processWebhook(payload, signature);

        if (accepted) {
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received"
            ));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Invalid webhook payload or signature"
            ));
        }
    }
}
