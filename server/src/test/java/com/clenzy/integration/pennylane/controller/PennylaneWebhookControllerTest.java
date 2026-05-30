package com.clenzy.integration.pennylane.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PennylaneWebhookController")
class PennylaneWebhookControllerTest {

    private PennylaneWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new PennylaneWebhookController();
    }

    @Test
    @DisplayName("handleSignatureEvent — status=signed -> 200 OK")
    void handleSignatureEvent_signed_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-abc-123");
        payload.put("status", "signed");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status=completed -> 200 OK (alias de signed)")
    void handleSignatureEvent_completed_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-xyz");
        payload.put("status", "completed");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status=declined -> 200 OK")
    void handleSignatureEvent_declined_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-1");
        payload.put("status", "declined");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status=refused -> 200 OK (alias de declined)")
    void handleSignatureEvent_refused_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-2");
        payload.put("status", "refused");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status=expired -> 200 OK")
    void handleSignatureEvent_expired_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-3");
        payload.put("status", "expired");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status inconnu -> 200 OK (default branch)")
    void handleSignatureEvent_unknownStatus_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-4");
        payload.put("status", "pending_review");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — status null -> 200 OK (default sur chaine vide)")
    void handleSignatureEvent_nullStatus_returnsOk() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("signature_request_id", "sig-5");
        payload.put("status", null);

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — payload sans signature_request_id -> 200 OK")
    void handleSignatureEvent_missingRequestId_returnsOk() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "signature_status_changed");
        payload.put("status", "signed");

        ResponseEntity<Void> response = controller.handleSignatureEvent(payload);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("handleSignatureEvent — payload vide -> 200 OK (default branch)")
    void handleSignatureEvent_emptyPayload_returnsOk() {
        ResponseEntity<Void> response = controller.handleSignatureEvent(new HashMap<>());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
