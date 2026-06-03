package com.clenzy.integration.nuki.controller;

import com.clenzy.integration.nuki.service.NukiWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("NukiWebhookController")
class NukiWebhookControllerTest {

    @Mock
    private NukiWebhookService nukiWebhookService;

    private NukiWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new NukiWebhookController(nukiWebhookService);
    }

    @Test
    @DisplayName("bridgeCallback — payload complet -> 200 OK + delegue au service")
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
        verify(nukiWebhookService).applyBridgeEvent(payload);
    }

    @Test
    @DisplayName("bridgeCallback — payload null -> 400 Bad Request, service non appele")
    void bridgeCallback_nullPayload_returnsBadRequest() {
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .containsEntry("status", "error")
                .containsEntry("message", "Empty payload");
        verify(nukiWebhookService, never()).applyBridgeEvent(any());
    }

    @Test
    @DisplayName("bridgeCallback — payload vide (map vide) -> 400 Bad Request, service non appele")
    void bridgeCallback_emptyPayload_returnsBadRequest() {
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(new HashMap<>());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", "error");
        verify(nukiWebhookService, never()).applyBridgeEvent(any());
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
        verify(nukiWebhookService).applyBridgeEvent(payload);
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

    @Test
    @DisplayName("bridgeCallback — le service leve une exception -> reste 200 OK (pas de retry Bridge)")
    void bridgeCallback_serviceThrows_stillReturnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 7);
        doThrow(new RuntimeException("db indisponible")).when(nukiWebhookService).applyBridgeEvent(any());

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "ok");
    }
}
