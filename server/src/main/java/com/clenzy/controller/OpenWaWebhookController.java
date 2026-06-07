package com.clenzy.controller;

import com.clenzy.service.messaging.OpenWaWebhookService;
import com.clenzy.service.messaging.whatsapp.OpenWaSignatureVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Webhook ENTRANT OpenWA (relais guest -> host).
 *
 * <p>Endpoint PUBLIC (cf. {@code SecurityConfig} / {@code SecurityConfigProd}) :
 * la securite repose sur la verification de la signature HMAC-SHA256
 * ({@code X-OpenWA-Signature}) du corps brut. On lit {@code byte[]} et non un
 * objet parse pour signer exactement les octets recus d'OpenWA.</p>
 *
 * <p>On renvoie toujours 200 apres une signature valide (meme si le payload est
 * inexploitable) pour eviter les retries OpenWA sur un corps deja accepte.</p>
 */
@RestController
@RequestMapping("/api/webhooks/whatsapp/openwa")
public class OpenWaWebhookController {

    private static final Logger log = LoggerFactory.getLogger(OpenWaWebhookController.class);

    private final OpenWaWebhookService webhookService;
    private final OpenWaSignatureVerifier signatureVerifier;

    public OpenWaWebhookController(OpenWaWebhookService webhookService,
                                  OpenWaSignatureVerifier signatureVerifier) {
        this.webhookService = webhookService;
        this.signatureVerifier = signatureVerifier;
    }

    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody(required = false) byte[] rawBody,
            @RequestHeader(value = "X-OpenWA-Signature", required = false) String signature) {
        if (!signatureVerifier.isValid(rawBody, signature)) {
            log.warn("Webhook OpenWA rejete : signature HMAC invalide");
            return ResponseEntity.status(401).build();
        }
        webhookService.process(rawBody);
        return ResponseEntity.ok().build();
    }
}
