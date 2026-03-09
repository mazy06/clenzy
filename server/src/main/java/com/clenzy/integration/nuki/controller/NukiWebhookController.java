package com.clenzy.integration.nuki.controller;

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

        Object nukiId = payload.get("nukiId");
        Object state = payload.get("state");
        Object stateName = payload.get("stateName");
        Object batteryCharge = payload.get("batteryCharge");
        Object batteryCritical = payload.get("batteryCritical");

        log.info("Webhook Nuki Bridge: nukiId={}, state={} ({}), battery={}%, critical={}",
                nukiId, state, stateName, batteryCharge, batteryCritical);

        // TODO: Mettre a jour l'etat du device en base
        // TODO: Emettre un evenement Outbox si batterie critique
        // TODO: Notifier si changement d'etat inattendu

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", "Event received"
        ));
    }
}
