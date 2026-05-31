package com.clenzy.integration.hubspot.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("HubSpotWebhookController")
class HubSpotWebhookControllerTest {

    private HubSpotWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new HubSpotWebhookController();
    }

    @Test
    @DisplayName("handleWebhookEvents — liste vide -> 200 OK")
    void handleWebhookEvents_emptyList_returnsOk() {
        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — event contact.propertyChange -> 200 OK")
    void handleWebhookEvents_contactPropertyChange_returnsOk() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("subscriptionType", "contact.propertyChange");
        event.put("objectId", 12345);
        event.put("propertyName", "email");
        event.put("propertyValue", "new@example.com");

        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of(event));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — event deal.creation -> 200 OK")
    void handleWebhookEvents_dealCreation_returnsOk() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("subscriptionType", "deal.creation");
        event.put("objectId", 9876);

        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of(event));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — event type inconnu -> 200 OK (gere par defaut)")
    void handleWebhookEvents_unknownType_returnsOk() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("subscriptionType", "ticket.creation");
        event.put("objectId", 555);

        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of(event));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — batch de plusieurs events -> 200 OK")
    void handleWebhookEvents_multipleEvents_returnsOk() {
        Map<String, Object> event1 = new LinkedHashMap<>();
        event1.put("subscriptionType", "contact.propertyChange");
        event1.put("objectId", 1);
        event1.put("propertyName", "phone");
        event1.put("propertyValue", "+33600000000");

        Map<String, Object> event2 = new LinkedHashMap<>();
        event2.put("subscriptionType", "deal.creation");
        event2.put("objectId", 2);

        Map<String, Object> event3 = new LinkedHashMap<>();
        event3.put("subscriptionType", "company.deletion");
        event3.put("objectId", 3);

        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of(event1, event2, event3));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — objectId numerique -> 200 OK (String.valueOf converti)")
    void handleWebhookEvents_numericObjectId_returnsOk() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("subscriptionType", "contact.propertyChange");
        event.put("objectId", 1234567890L); // long, pas String
        event.put("propertyName", "name");
        event.put("propertyValue", "John");

        ResponseEntity<Void> response = controller.handleWebhookEvents(List.of(event));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleWebhookEvents — subscriptionType absent -> NPE (switch sur null)")
    void handleWebhookEvents_missingSubscriptionType_throwsNpe() {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("objectId", 1);

        // Le switch sur une string null jette NPE — c'est le comportement actuel.
        // On documente ce contrat (un payload invalide cote HubSpot fait crasher
        // le webhook et HubSpot retry).
        org.junit.jupiter.api.Assertions.assertThrows(
            NullPointerException.class,
            () -> controller.handleWebhookEvents(List.of(event))
        );
    }
}
