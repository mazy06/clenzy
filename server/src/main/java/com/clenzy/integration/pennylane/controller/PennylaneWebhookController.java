package com.clenzy.integration.pennylane.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Webhook controller pour les callbacks Pennylane.
 * Recoit les notifications de completion de signature.
 *
 * Endpoint public : doit etre declare dans SecurityConfigProd.
 */
@RestController
@RequestMapping("/api/webhooks/pennylane")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PennylaneWebhookController.class);

    /**
     * Recoit les evenements de signature Pennylane.
     *
     * @param payload donnees de l'evenement
     * @return 200 OK pour confirmer la reception
     */
    @PostMapping("/signature")
    public ResponseEntity<Void> handleSignatureEvent(@RequestBody Map<String, Object> payload) {
        String eventType = (String) payload.get("event");
        String signatureRequestId = String.valueOf(payload.get("signature_request_id"));
        String status = (String) payload.get("status");

        log.info("Pennylane webhook — evenement: {}, requestId: {}, status: {}",
            eventType, signatureRequestId, status);

        switch (status != null ? status : "") {
            case "signed", "completed" -> handleSignatureCompleted(signatureRequestId, payload);
            case "declined", "refused" -> handleSignatureDeclined(signatureRequestId, payload);
            case "expired" -> handleSignatureExpired(signatureRequestId, payload);
            default -> log.debug("Pennylane webhook — statut non gere: {}", status);
        }

        return ResponseEntity.ok().build();
    }

    private void handleSignatureCompleted(String requestId, Map<String, Object> payload) {
        log.info("Pennylane — signature completee: {}", requestId);
        // TODO: Mettre a jour le statut du document dans Clenzy
        // TODO: Telecharger et stocker le document signe
    }

    private void handleSignatureDeclined(String requestId, Map<String, Object> payload) {
        log.info("Pennylane — signature refusee: {}", requestId);
        // TODO: Notifier le proprietaire du refus
    }

    private void handleSignatureExpired(String requestId, Map<String, Object> payload) {
        log.info("Pennylane — signature expiree: {}", requestId);
        // TODO: Marquer la demande comme expiree et notifier
    }
}
