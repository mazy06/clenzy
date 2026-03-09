package com.clenzy.controller;

import com.clenzy.integration.keynest.KeyNestWebhookHandler;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour la reception des webhooks KeyNest.
 * Endpoint public (pas d'authentification JWT) — la securite repose sur la verification HMAC-SHA256.
 *
 * Endpoint :
 * - POST /api/webhooks/keynest  → reception des notifications KeyNest (cle recuperee, retournee, etc.)
 */
@RestController
@RequestMapping("/api/webhooks/keynest")
@Tag(name = "KeyNest Webhooks", description = "Reception des webhooks KeyNest (public, HMAC-SHA256)")
public class KeyNestWebhookController {

    private static final Logger log = LoggerFactory.getLogger(KeyNestWebhookController.class);

    private final KeyNestWebhookHandler webhookHandler;
    private final ObjectMapper objectMapper;

    public KeyNestWebhookController(KeyNestWebhookHandler webhookHandler,
                                     ObjectMapper objectMapper) {
        this.webhookHandler = webhookHandler;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    @Operation(summary = "Recevoir un webhook KeyNest",
            description = "KeyNest envoie des notifications JSON quand une cle est recuperee ou retournee")
    public ResponseEntity<?> handleWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-KeyNest-Signature", required = false) String signature) {

        log.info("Webhook KeyNest recu (signature present: {})", signature != null);

        // Verifier la signature HMAC-SHA256
        if (signature != null && !webhookHandler.verifySignature(payload, signature)) {
            log.warn("Webhook KeyNest rejete : signature invalide");
            return ResponseEntity.status(401).body(Map.of(
                    "error", "invalid_signature",
                    "message", "Signature HMAC invalide"
            ));
        }

        try {
            Map<String, Object> body = objectMapper.readValue(payload, new TypeReference<>() {});
            webhookHandler.handleWebhookEvent(body);
            return ResponseEntity.ok(Map.of("status", "processed"));
        } catch (Exception e) {
            log.error("Erreur traitement webhook KeyNest: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "processing_error",
                    "message", "Erreur lors du traitement du webhook"
            ));
        }
    }
}
