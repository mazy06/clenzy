package com.clenzy.integration.booking.controller;

import com.clenzy.integration.booking.dto.BookingWebhookPayload;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingWebhookService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingWebhookControllerTest {

    @Mock private BookingWebhookService webhookService;
    @Mock private BookingConnectionRepository connectionRepository;

    private ObjectMapper objectMapper;
    private BookingWebhookController controller;

    private static final String HOTEL_ID = "hotel-123";
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        controller = new BookingWebhookController(webhookService, connectionRepository, objectMapper);
    }

    private String buildValidPayload() throws Exception {
        BookingWebhookPayload payload = new BookingWebhookPayload(
                "reservation.created",
                HOTEL_ID,
                "res-789",
                Map.of("room_id", "room-456"),
                "2025-07-01T12:00:00Z"
        );
        return objectMapper.writeValueAsString(payload);
    }

    // ===== VALID SIGNATURE =====

    @Nested
    @DisplayName("Valid webhook processing")
    class ValidWebhook {

        @Test
        @DisplayName("returns 200 OK when signature is valid and event is processed")
        void handleWebhook_validSignature_processesEvent() throws Exception {
            String payload = buildValidPayload();
            String signature = "valid-hmac-signature";

            when(webhookService.validateWebhookSignature(signature, payload)).thenReturn(true);

            BookingConnection connection = new BookingConnection(ORG_ID, HOTEL_ID);
            when(connectionRepository.findByHotelId(HOTEL_ID)).thenReturn(Optional.of(connection));

            ResponseEntity<Map<String, String>> response = controller.receiveWebhook(payload, signature);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "ok");
            verify(webhookService).processWebhook(any(BookingWebhookPayload.class), eq(ORG_ID));
        }
    }

    // ===== INVALID SIGNATURE =====

    @Nested
    @DisplayName("Invalid signature")
    class InvalidSignature {

        @Test
        @DisplayName("returns 400 when signature validation fails")
        void handleWebhook_invalidSignature_returns401() throws Exception {
            String payload = buildValidPayload();
            String signature = "invalid-signature";

            when(webhookService.validateWebhookSignature(signature, payload)).thenReturn(false);

            ResponseEntity<Map<String, String>> response = controller.receiveWebhook(payload, signature);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsEntry("status", "error");
            assertThat(response.getBody()).containsEntry("message", "Invalid webhook signature");
            verify(webhookService, never()).processWebhook(any(), any());
        }
    }

    // ===== MISSING SIGNATURE =====

    @Nested
    @DisplayName("Missing signature")
    class MissingSignature {

        @Test
        @DisplayName("returns 400 when signature header is missing")
        void handleWebhook_missingSignature_returns400() throws Exception {
            String payload = buildValidPayload();

            when(webhookService.validateWebhookSignature(null, payload)).thenReturn(false);

            ResponseEntity<Map<String, String>> response = controller.receiveWebhook(payload, null);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsEntry("status", "error");
            verify(webhookService, never()).processWebhook(any(), any());
        }
    }

    // ===== MALFORMED PAYLOAD =====

    @Nested
    @DisplayName("Malformed payload")
    class MalformedPayload {

        @Test
        @DisplayName("returns 400 when payload is not valid JSON")
        void handleWebhook_malformedPayload_returns400() {
            String payload = "this is not json";
            String signature = "some-signature";

            when(webhookService.validateWebhookSignature(signature, payload)).thenReturn(true);

            ResponseEntity<Map<String, String>> response = controller.receiveWebhook(payload, signature);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsEntry("status", "error");
            assertThat(response.getBody()).containsEntry("message", "Invalid webhook payload");
        }
    }
}
