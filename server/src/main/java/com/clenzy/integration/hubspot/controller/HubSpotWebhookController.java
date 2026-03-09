package com.clenzy.integration.hubspot.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Webhook controller pour les callbacks HubSpot.
 * Recoit les notifications d'evenements CRM (contact.propertyChange, deal.creation, etc.).
 *
 * Endpoint public : doit etre declare dans SecurityConfigProd.
 */
@RestController
@RequestMapping("/api/webhooks/hubspot")
@ConditionalOnProperty(name = "clenzy.hubspot.api-key")
public class HubSpotWebhookController {

    private static final Logger log = LoggerFactory.getLogger(HubSpotWebhookController.class);

    /**
     * Recoit les evenements webhook HubSpot.
     * HubSpot envoie un tableau d'evenements en batch.
     *
     * Types d'evenements geres :
     * - contact.propertyChange : modification d'une propriete d'un contact
     * - deal.creation : creation d'un nouveau deal
     *
     * @param events liste des evenements HubSpot
     * @return 200 OK pour confirmer la reception
     */
    @PostMapping
    public ResponseEntity<Void> handleWebhookEvents(@RequestBody List<Map<String, Object>> events) {
        log.info("HubSpot webhook — reception de {} evenement(s)", events.size());

        for (Map<String, Object> event : events) {
            String subscriptionType = (String) event.get("subscriptionType");
            String objectId = String.valueOf(event.get("objectId"));

            log.info("HubSpot webhook — type: {}, objectId: {}", subscriptionType, objectId);

            switch (subscriptionType) {
                case "contact.propertyChange" -> handleContactPropertyChange(event);
                case "deal.creation" -> handleDealCreation(event);
                default -> log.debug("HubSpot webhook — type non gere: {}", subscriptionType);
            }
        }

        return ResponseEntity.ok().build();
    }

    private void handleContactPropertyChange(Map<String, Object> event) {
        String propertyName = (String) event.get("propertyName");
        String propertyValue = (String) event.get("propertyValue");
        String objectId = String.valueOf(event.get("objectId"));

        log.info("HubSpot — contact {} propriete modifiee: {} = {}",
            objectId, propertyName, propertyValue);

        // TODO: Synchroniser les changements de propriete vers le guest Clenzy
    }

    private void handleDealCreation(Map<String, Object> event) {
        String objectId = String.valueOf(event.get("objectId"));

        log.info("HubSpot — nouveau deal cree: {}", objectId);

        // TODO: Creer une reservation Clenzy correspondante si pertinent
    }
}
