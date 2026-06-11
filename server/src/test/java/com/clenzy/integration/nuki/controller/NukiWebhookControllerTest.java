package com.clenzy.integration.nuki.controller;

import com.clenzy.integration.nuki.model.NukiConnection;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NukiWebhookController")
class NukiWebhookControllerTest {

    @Mock
    private NukiWebhookService nukiWebhookService;

    private NukiWebhookController controller;

    private static final String VALID_TOKEN = "secret-token-abc";
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        controller = new NukiWebhookController(nukiWebhookService);
    }

    private NukiConnection connection() {
        NukiConnection conn = new NukiConnection();
        conn.setOrganizationId(ORG_ID);
        conn.setWebhookSecret(VALID_TOKEN);
        return conn;
    }

    private void stubValidToken() {
        lenient().when(nukiWebhookService.resolveConnectionByToken(VALID_TOKEN))
                .thenReturn(connection());
    }

    @Test
    @DisplayName("I2-IOT-01 — token invalide -> 401, service de traitement non appele")
    void bridgeCallback_invalidToken_returns401() {
        when(nukiWebhookService.resolveConnectionByToken("bad")).thenReturn(null);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 12345);

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback("bad", payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody())
                .containsEntry("status", "error")
                .containsEntry("message", "Invalid webhook secret");
        verify(nukiWebhookService, never()).applyBridgeEvent(any(), anyLong());
    }

    @Test
    @DisplayName("bridgeCallback — token valide + payload complet -> 200 OK + delegue (org scope)")
    void bridgeCallback_validPayload_returnsOk() {
        stubValidToken();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 12345);
        payload.put("state", 1);
        payload.put("stateName", "locked");
        payload.put("batteryCharge", 87);
        payload.put("batteryCritical", false);
        payload.put("doorsensorState", 2);

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(VALID_TOKEN, payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("status", "ok")
                .containsEntry("message", "Event received");
        verify(nukiWebhookService).applyBridgeEvent(payload, ORG_ID);
    }

    @Test
    @DisplayName("bridgeCallback — token valide + payload null -> 400 Bad Request, traitement non appele")
    void bridgeCallback_nullPayload_returnsBadRequest() {
        stubValidToken();
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(VALID_TOKEN, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .containsEntry("status", "error")
                .containsEntry("message", "Empty payload");
        verify(nukiWebhookService, never()).applyBridgeEvent(any(), anyLong());
    }

    @Test
    @DisplayName("bridgeCallback — token valide + payload vide -> 400 Bad Request")
    void bridgeCallback_emptyPayload_returnsBadRequest() {
        stubValidToken();
        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(VALID_TOKEN, new HashMap<>());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", "error");
        verify(nukiWebhookService, never()).applyBridgeEvent(any(), anyLong());
    }

    @Test
    @DisplayName("bridgeCallback — token valide + batterie critique -> 200 OK")
    void bridgeCallback_lowBattery_returnsOk() {
        stubValidToken();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 99);
        payload.put("batteryCritical", true);
        payload.put("batteryCharge", 5);

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(VALID_TOKEN, payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "ok");
        verify(nukiWebhookService).applyBridgeEvent(payload, ORG_ID);
    }

    @Test
    @DisplayName("bridgeCallback — service leve une exception -> reste 200 OK (pas de retry Bridge)")
    void bridgeCallback_serviceThrows_stillReturnsOk() {
        stubValidToken();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("nukiId", 7);
        doThrow(new RuntimeException("db indisponible"))
                .when(nukiWebhookService).applyBridgeEvent(any(), eq(ORG_ID));

        ResponseEntity<Map<String, String>> response = controller.bridgeCallback(VALID_TOKEN, payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "ok");
    }
}
