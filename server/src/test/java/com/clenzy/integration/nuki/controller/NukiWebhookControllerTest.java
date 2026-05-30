package com.clenzy.integration.nuki.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("NukiWebhookController")
class NukiWebhookControllerTest {

    private NukiWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new NukiWebhookController();
    }

    @Test
    @DisplayName("bridgeCallback — payload complet -> 200 OK avec status=ok")
    void bridgeCallback_validPayload_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 12345);
        payload.put("state", 1);
        payload.put("stateName", "locked");
        payload.put("batteryCharge", 87);
        payload.put("batteryCritical", false);
        payload.put("doorsensorState", 2);

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("status", "ok")
                .containsEntry("message", "Event received");
    }

    @Test
    @DisplayName("bridgeCallback — payload null -> 400 Bad Request avec status=error")
    void bridgeCallback_nullPayload_returnsBadRequest() {
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .containsEntry("status", "error")
                .containsEntry("message", "Empty payload");
    }

    @Test
    @DisplayName("bridgeCallback — payload vide (map vide) -> 400 Bad Request")
    void bridgeCallback_emptyPayload_returnsBadRequest() {
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(new HashMap<>());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", "error");
    }

    @Test
    @DisplayName("bridgeCallback — payload partiel (batterie critique) -> 200 OK")
    void bridgeCallback_lowBattery_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 99);
        payload.put("batteryCritical", true);
        payload.put("batteryCharge", 5);

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "ok");
    }

    @Test
    @DisplayName("bridgeCallback — payload avec champs additionnels -> 200 OK (champs ignores)")
    void bridgeCallback_unknownFields_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 1);
        payload.put("unknownField", "value");

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
