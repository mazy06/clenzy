package com.clenzy.integration.minut.controller;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.minut.config.MinutConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

/**
 * Controller pour les webhooks Minut.
 *
 * Endpoint public (pas d'authentification JWT) car Minut envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC-SHA256 dans le header
 * - Traitement asynchrone via Kafka
 *
 * Un succes HTTP confirme uniquement la publication acquittee par Kafka,
 * jamais le traitement metier asynchrone. Une publication non confirmee
 * retourne 503 ; elle peut toutefois avoir atteint le broker avant le timeout.
 */
@RestController
@RequestMapping("/api/webhooks")
@PreAuthorize("permitAll()") // Route publique deja declaree dans SecurityConfigProd, HMAC obligatoire.
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
        String secret = config.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.error("Webhook Minut indisponible : secret HMAC non configure");
            return ResponseEntity.status(503).body(Map.of("status", "error", "message", "Webhook unavailable"));
        }
        if (payload == null || payload.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Invalid payload"));
        }
        if (signature == null || !signature.matches("[a-fA-F0-9]{64}") || !validateSignature(payload, signature, secret)) {
            log.warn("Signature webhook Minut invalide");
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Invalid signature"));
        }

        try {
            // Le delai borne l'attente de l'ACK, pas l'acquisition des metadonnees dans send().
            Objects.requireNonNull(kafkaTemplate.send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, payload)
                    .get(3, TimeUnit.SECONDS));
            log.info("Publication webhook Minut acquittee par Kafka");
            return ResponseEntity.ok(Map.of("status", "ok", "message", "Event received"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return publicationUnconfirmed();
        } catch (Exception e) {
            return publicationUnconfirmed();
        }
    }

    private ResponseEntity<Map<String, String>> publicationUnconfirmed() {
        log.error("Publication webhook Minut non confirmee par Kafka");
        return ResponseEntity.status(503).body(Map.of("status", "error", "message", "Event receipt unconfirmed"));
    }

    /**
     * Valide la signature HMAC-SHA256 du payload.
     */
    private boolean validateSignature(String payload, String expectedSignature, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            String computedSignature = sb.toString();

            // Comparaison constant-time pour eviter une timing attack sur la signature.
            return MessageDigest.isEqual(
                    computedSignature.getBytes(StandardCharsets.UTF_8),
                    expectedSignature.toLowerCase().getBytes(StandardCharsets.UTF_8));

        } catch (Exception e) {
            log.error("Erreur validation signature webhook Minut");
            return false;
        }
    }
}
