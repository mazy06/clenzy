package com.clenzy.integration.nuki.controller;

import com.clenzy.integration.nuki.model.NukiConnection;
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
 * envoie les evenements directement. La securite repose sur (I2-IOT-01) :
 * - Un secret partage PAR CONNEXION, porte dans l'URL de callback
 *   ({@code /bridge-callback/{token}}), compare en temps constant et qui
 *   resout l'organisation cible. Rejet (401) si le token est absent ou invalide.
 * - Le perimetre org : la serrure visee doit appartenir a l'organisation du secret.
 *
 * IMPORTANT : Repondre 200 OK rapidement pour eviter les retries du Bridge
 * (UNE FOIS le token valide). Un token absent/invalide est rejete (401).
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
     * Callback du Nuki Bridge, authentifie par un secret par connexion dans l'URL.
     *
     * Le Bridge envoie un POST avec le payload contenant :
     * - nukiId : identifiant de la serrure
     * - state : etat du verrou (1=locked, 3=unlocked, etc.)
     * - stateName : nom lisible de l'etat
     * - batteryCritical : true si batterie faible
     * - batteryCharge : niveau de batterie (0-100)
     * - doorsensorState : etat du capteur de porte
     *
     * @param token secret partage par connexion (I2-IOT-01). 401 si absent/invalide.
     */
    @PostMapping("/bridge-callback/{token}")
    @Operation(summary = "Webhook Nuki Bridge",
            description = "Recoit les evenements du Nuki Bridge (changements d'etat, batterie). "
                    + "Authentifie par un secret par connexion dans l'URL.")
    public ResponseEntity<Map<String, String>> bridgeCallback(
            @PathVariable("token") String token,
            @RequestBody Map<String, Object> payload) {

        // I2-IOT-01 : authentifier l'origine via le secret par connexion AVANT tout
        // traitement. Token absent/vide ou non reconnu → 401 (rejet, pas de fail-open).
        NukiConnection connection = nukiWebhookService.resolveConnectionByToken(token);
        if (connection == null) {
            log.warn("Webhook Nuki Bridge rejete : secret de callback absent ou invalide");
            return ResponseEntity.status(401).body(Map.of(
                    "status", "error",
                    "message", "Invalid webhook secret"
            ));
        }

        if (payload == null || payload.isEmpty()) {
            log.warn("Webhook Nuki Bridge recu avec payload vide (org={})", connection.getOrganizationId());
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Empty payload"
            ));
        }

        log.info("Webhook Nuki Bridge (org={}): nukiId={}, state={} ({}), battery={}%, critical={}",
                connection.getOrganizationId(), payload.get("nukiId"), payload.get("state"),
                payload.get("stateName"), payload.get("batteryCharge"), payload.get("batteryCritical"));

        // Persiste l'etat de verrou + batterie, borne a l'org du secret. On ne propage
        // jamais d'erreur au Bridge (toujours 200 une fois authentifie) pour eviter les
        // retries : l'etat se resynchronise au prochain evenement ou via getStatus.
        try {
            nukiWebhookService.applyBridgeEvent(payload, connection.getOrganizationId());
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
