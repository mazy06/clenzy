package com.clenzy.integration.minut.controller;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.minut.config.MinutConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Controller pour les webhooks Minut.
 *
 * Endpoint public (pas d'authentification JWT) car Minut envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC-SHA256 dans le header
 * - Traitement asynchrone via Kafka
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible (< 5s)
 * pour eviter les retries de Minut. Le traitement reel est
 * asynchrone via Kafka.
 */
@RestController
@RequestMapping("/api/webhooks")
@Tag(name = "Minut Webhooks", description = "Reception des evenements Minut")
public class MinutWebhookController {

    private static final Logger log = LoggerFactory.getLogger(MinutWebhookController.class);

    private final MinutConfig config;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public MinutWebhookController(MinutConfig config,
                                   KafkaTemplate<String, Object> kafkaTemplate) {
        this.config = config;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Endpoint webhook Minut.
     * Recoit les evenements (disturbance, device_offline, etc.).
     *
     * Header attendu : X-Minut-Signature (HMAC-SHA256 du body)
     */
    @PostMapping("/minut")
    @Operation(summary = "Webhook Minut",
            description = "Recoit les evenements Minut (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Minut-Signature", required = false) String signature) {

        log.debug("Webhook Minut recu ({} bytes)", payload != null ? payload.length() : 0);

        // Valider la signature HMAC si le secret est configure
        if (config.getWebhookSecret() != null && !config.getWebhookSecret().isEmpty()) {
            if (signature == null || !validateSignature(payload, signature)) {
                log.warn("Signature webhook Minut invalide");
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Invalid signature"
                ));
            }
        }

        try {
            // Publier dans Kafka pour traitement asynchrone
            kafkaTemplate.send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, payload);
            log.info("Webhook Minut publie dans Kafka");

            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received"
            ));

        } catch (Exception e) {
            log.error("Erreur publication webhook Minut dans Kafka: {}", e.getMessage());
            // Retourner 200 quand meme pour eviter les retries de Minut
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received (processing delayed)"
            ));
        }
    }

    /**
     * Valide la signature HMAC-SHA256 du payload.
     */
    private boolean validateSignature(String payload, String expectedSignature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            String computedSignature = sb.toString();

            return computedSignature.equalsIgnoreCase(expectedSignature);

        } catch (Exception e) {
            log.error("Erreur validation signature webhook Minut: {}", e.getMessage());
            return false;
        }
    }
}
