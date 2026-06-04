package com.clenzy.integration.nuki.controller;

import com.clenzy.integration.nuki.service.NukiWebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour les webhooks Nuki Bridge.
 *
 * Endpoint public (pas d'authentification JWT) car le Nuki Bridge
 * envoie les evenements directement. La securite repose sur :
 * - Filtrage reseau (le Bridge est sur le LAN)
 * - Validation du payload
 *
 * IMPORTANT : Repondre 200 OK rapidement pour eviter les retries du Bridge.
 *
 * Evenements recus :
 * - Changement d'etat de la serrure (lock/unlock)
 * - Mise a jour du niveau de batterie
 * - Etat de la porte (ouverte/fermee)
 */
@RestController
@RequestMapping("/api/webhooks/nuki")
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
@Tag(name = "Nuki Webhooks", description = "Reception des evenements Nuki Bridge")
public class NukiWebhookController {

    private static final Logger log = LoggerFactory.getLogger(NukiWebhookController.class);

    private final NukiWebhookService nukiWebhookService;

    public NukiWebhookController(NukiWebhookService nukiWebhookService) {
        this.nukiWebhookService = nukiWebhookService;
    }

    /**
     * Callback du Nuki Bridge.
     *
     * Le Bridge envoie un POST avec le payload contenant :
     * - nukiId : identifiant de la serrure
     * - state : etat du verrou (1=locked, 3=unlocked, etc.)
     * - stateName : nom lisible de l'etat
     * - batteryCritical : true si batterie faible
     * - batteryCharge : niveau de batterie (0-100)
     * - doorsensorState : etat du capteur de porte
     */
    @PostMapping("/bridge-callback")
    @Operation(summary = "Webhook Nuki Bridge",
            description = "Recoit les evenements du Nuki Bridge (changements d'etat, batterie)")
    public ResponseEntity<Map<String, String>> bridgeCallback(
            @RequestBody Map<String, Object> payload) {

        if (payload == null || payload.isEmpty()) {
            log.warn("Webhook Nuki Bridge recu avec payload vide");
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Empty payload"
            ));
        }

        log.info("Webhook Nuki Bridge: nukiId={}, state={} ({}), battery={}%, critical={}",
                payload.get("nukiId"), payload.get("state"), payload.get("stateName"),
                payload.get("batteryCharge"), payload.get("batteryCritical"));

        // Persiste l'etat de verrou + batterie. On ne propage jamais d'erreur au
        // Bridge (toujours 200) pour eviter les retries : l'etat se resynchronise
        // au prochain evenement ou via getStatus a la demande.
        try {
            nukiWebhookService.applyBridgeEvent(payload);
        } catch (Exception e) {
            log.error("Webhook Nuki : echec de traitement (nukiId={}): {}",
                    payload.get("nukiId"), e.getMessage(), e);
        }

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", "Event received"
        ));
    }
}
