package com.clenzy.integration.expedia.controller;

import com.clenzy.integration.expedia.service.ExpediaWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour les webhooks Expedia/VRBO.
 *
 * Endpoint public (pas d'authentification JWT) car Expedia envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header
 * - Deduplication via event_id
 * - Rate limiting au niveau Nginx
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible
 * pour eviter les retries d'Expedia. Le traitement reel est
 * asynchrone via Kafka.
 */
@RestController
@RequestMapping("/api/webhooks/expedia")
@Tag(name = "Expedia Webhooks", description = "Reception des evenements Expedia/VRBO")
public class ExpediaWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ExpediaWebhookController.class);

    private final ExpediaWebhookService webhookService;

    public ExpediaWebhookController(ExpediaWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    /**
     * Endpoint webhook Expedia/VRBO.
     * Recoit les evenements (reservations, disponibilites, tarifs).
     *
     * Header attendu : X-Expedia-Signature (HMAC-SHA256 du body)
     */
    @PostMapping
    @Operation(summary = "Webhook Expedia/VRBO",
            description = "Recoit les evenements Expedia/VRBO (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Expedia-Signature", required = false) String signature) {

        log.debug("Webhook Expedia recu ({} bytes)", payload != null ? payload.length() : 0);

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
