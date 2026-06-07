package com.clenzy.controller;

import com.clenzy.service.messaging.WhatsAppWebhookService;
import com.clenzy.service.messaging.whatsapp.WhatsAppSignatureVerifier;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/whatsapp")
public class WhatsAppWebhookController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookController.class);

    private final WhatsAppWebhookService webhookService;
    private final WhatsAppSignatureVerifier signatureVerifier;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookController(WhatsAppWebhookService webhookService,
                                     WhatsAppSignatureVerifier signatureVerifier,
                                     ObjectMapper objectMapper) {
        this.webhookService = webhookService;
        this.signatureVerifier = signatureVerifier;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<String> verify(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {
        // Compte WhatsApp GLOBAL : plus de param org_id (un seul webhook plateforme).
        if (webhookService.verifyWebhook(mode, token, challenge)) {
            return ResponseEntity.ok(challenge);
        }
        return ResponseEntity.status(403).body("Forbidden");
    }

    /**
     * Endpoint public (cf. SecurityConfigProd) : la securite repose sur la
     * verification de la signature HMAC-SHA256 du corps brut (X-Hub-Signature-256).
     * On lit {@code byte[]} et non un objet parse pour signer exactement les
     * octets recus de Meta.
     */
    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody byte[] rawBody,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature) {
        if (!signatureVerifier.isValid(rawBody, signature)) {
            log.warn("Webhook WhatsApp rejete : signature HMAC invalide");
            return ResponseEntity.status(401).build();
        }
        try {
            Map<String, Object> payload = objectMapper.readValue(rawBody, new TypeReference<>() {});
            webhookService.processWebhook(payload);
        } catch (Exception e) {
            // Payload authentique mais illisible : on log et on renvoie 200 pour
            // eviter les retries Meta sur un corps malforme.
            log.error("Erreur parsing webhook WhatsApp: {}", e.getMessage());
        }
        return ResponseEntity.ok().build();
    }
}
