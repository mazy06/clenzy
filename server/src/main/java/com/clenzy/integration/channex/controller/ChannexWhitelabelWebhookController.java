package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Point d'entree reserve aux futurs evenements Channex Whitelabel de Baitly.
 *
 * <p>Le header partage X-Channex-Token suit le meme contrat que le webhook de
 * reservations. Cette route est deja publique dans SecurityConfigProd ; le
 * fournisseur ne dispose pas d'un JWT utilisateur.</p>
 *
 * <p>Le routage Whitelabel n'est pas qualifie. Un evenement authentifie recoit
 * donc 503 : ne jamais acquitter un traitement absent ni journaliser le payload.
 * Ne pas enregistrer cette URL chez le fournisseur avant qualification du
 * contrat, du routage multi-tenant et des reprises. Le webhook de reservations
 * reste sur son endpoint distinct.</p>
 */
@RestController
@RequestMapping("/api/webhooks/channex/whitelabel")
@PreAuthorize("permitAll()")
public class ChannexWhitelabelWebhookController {
    private final ChannexSignatureValidator signatureValidator;
    private final ChannexMetrics metrics;

    public ChannexWhitelabelWebhookController(ChannexSignatureValidator signatureValidator,
                                             ChannexMetrics metrics) {
        this.signatureValidator = signatureValidator;
        this.metrics = metrics;
    }

    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Channex-Token", required = false) String token) {
        if (!signatureValidator.isValid(token)) {
            metrics.recordWebhookReceived("whitelabel", "invalid_signature");
            return ResponseEntity.status(401).build();
        }
        // Labels fixes : ni evenement fourni par l'appelant, ni donnee personnelle.
        metrics.recordWebhookReceived("whitelabel", "not_ready");
        return ResponseEntity.status(503).build();
    }
}
