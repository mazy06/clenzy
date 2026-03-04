package com.clenzy.integration.twilio.controller;

import com.clenzy.integration.twilio.config.TwilioConfig;
import com.twilio.security.RequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * Webhook controller pour les callbacks Twilio.
 * Recoit les notifications de statut de livraison et les messages entrants.
 *
 * Endpoints :
 *  POST /api/webhooks/twilio/status  — Status callback (delivered, failed, undelivered)
 *  POST /api/webhooks/twilio/inbound — Messages SMS/WhatsApp entrants
 */
@RestController
@RequestMapping("/api/webhooks/twilio")
@ConditionalOnProperty(name = "clenzy.twilio.account-sid")
public class TwilioWebhookController {

    private static final Logger log = LoggerFactory.getLogger(TwilioWebhookController.class);

    private final TwilioConfig config;
    private final RequestValidator requestValidator;

    public TwilioWebhookController(TwilioConfig config) {
        this.config = config;
        this.requestValidator = new RequestValidator(config.getAuthToken());
    }

    /**
     * Status callback — Twilio envoie les mises a jour de statut ici.
     * Statuts possibles : queued, sent, delivered, undelivered, failed.
     */
    @PostMapping("/status")
    public ResponseEntity<String> handleStatusCallback(
            @RequestParam Map<String, String> params,
            HttpServletRequest request) {

        if (!validateTwilioSignature(request, params)) {
            log.warn("Twilio status callback — signature invalide");
            return ResponseEntity.status(403).body("Invalid signature");
        }

        String messageSid = params.get("MessageSid");
        String messageStatus = params.get("MessageStatus");
        String to = params.get("To");
        String errorCode = params.get("ErrorCode");

        log.info("Twilio status callback: SID={}, status={}, to={}, errorCode={}",
                messageSid, messageStatus, to, errorCode);

        // TODO: Mettre a jour le GuestMessageLog avec le nouveau statut
        // Quand le systeme de logs de messages sera enrichi

        return ResponseEntity.ok("OK");
    }

    /**
     * Inbound message — SMS ou WhatsApp entrant.
     */
    @PostMapping("/inbound")
    public ResponseEntity<String> handleInboundMessage(
            @RequestParam Map<String, String> params,
            HttpServletRequest request) {

        if (!validateTwilioSignature(request, params)) {
            log.warn("Twilio inbound — signature invalide");
            return ResponseEntity.status(403).body("Invalid signature");
        }

        String from = params.get("From");
        String body = params.get("Body");
        String messageSid = params.get("MessageSid");

        log.info("Message entrant Twilio: SID={}, from={}, body_length={}",
                messageSid, from, body != null ? body.length() : 0);

        // TODO: Router le message entrant vers le systeme de messagerie guest
        // pour afficher dans l'inbox du proprietaire

        // Reponse TwiML vide (pas de reponse automatique)
        return ResponseEntity.ok("<Response></Response>");
    }

    /**
     * Valide la signature Twilio sur la requete entrante.
     * Protege contre les requetes forgees.
     */
    private boolean validateTwilioSignature(HttpServletRequest request, Map<String, String> params) {
        try {
            String signature = request.getHeader("X-Twilio-Signature");
            if (signature == null || signature.isBlank()) {
                return false;
            }

            String url = request.getRequestURL().toString();
            return requestValidator.validate(url, params, signature);
        } catch (Exception e) {
            log.error("Erreur validation signature Twilio: {}", e.getMessage());
            return false;
        }
    }
}
