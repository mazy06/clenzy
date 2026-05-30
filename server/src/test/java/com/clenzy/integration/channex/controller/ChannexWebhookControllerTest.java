package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channex.service.ChannexBookingService;
import com.clenzy.integration.channex.service.ChannexMessagingService;
import com.clenzy.integration.channex.service.ChannexSyncLogService;
import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexWebhookController")
class ChannexWebhookControllerTest {

    @Mock private ChannexSignatureValidator signatureValidator;
    @Mock private ChannexBookingService bookingService;
    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexSyncLogService syncLogService;
    @Mock private ChannexMessagingService messagingService;

    private ObjectMapper objectMapper;
    private ChannexWebhookController controller;

    private static final String VALID_NEW_BOOKING_BODY = """
        {
          "event": "booking_new",
          "timestamp": "2026-06-01T10:00:00Z",
          "user_id": "u-1",
          "property_id": "channex-prop-1",
          "payload": {
            "id": "booking-abc",
            "ota_reservation_code": "HM6T7A8B9C",
            "ota_name": "airbnb",
            "property_id": "channex-prop-1",
            "status": "new",
            "arrival_date": "2026-07-01",
            "departure_date": "2026-07-05",
            "amount": 480.00,
            "currency": "EUR",
            "customer": { "name": "Jean", "surname": "Dupont", "mail": "jean@example.com" },
            "rooms": [{ "occupancy": { "adults": 2, "children": 0 } }]
          }
        }
        """;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        controller = new ChannexWebhookController(signatureValidator, bookingService, objectMapper,
            new ChannexMetrics(new SimpleMeterRegistry()),
            channexClient, mappingRepository, syncLogService, messagingService);
    }

    @Test
    @DisplayName("Signature invalide -> 401 + bookingService non appele")
    void rejectsInvalidSignature() {
        when(signatureValidator.isValid(anyString())).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-invalid", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).containsEntry("error", "invalid_token");
        verify(bookingService, never()).handleNewBooking(any());
    }

    @Test
    @DisplayName("Signature null -> 401 (header manquant)")
    void rejectsMissingSignature() {
        when(signatureValidator.isValid(any())).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            null, VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    @DisplayName("Payload JSON malforme -> 400 + bookingService non appele")
    void rejectsMalformedPayload() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", "{ broken json"
        );

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "malformed_payload");
        verify(bookingService, never()).handleNewBooking(any());
    }

    @Test
    @DisplayName("event=booking_new -> dispatch vers handleNewBooking + 200")
    void dispatchesBookingNew() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        Reservation r = new Reservation();
        r.setId(42L);
        r.setConfirmationCode("HM6T7A8B9C");
        when(bookingService.handleNewBooking(any())).thenReturn(r);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_new");
        assertThat(response.getBody()).containsEntry("reservationId", 42L);
        assertThat(response.getBody()).containsEntry("confirmationCode", "HM6T7A8B9C");
        verify(bookingService).handleNewBooking(any());
    }

    @Test
    @DisplayName("event=booking_modification -> dispatch + 200")
    void dispatchesBookingModification() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_modification");
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        Reservation r = new Reservation();
        r.setId(99L);
        when(bookingService.handleModification(any())).thenReturn(Optional.of(r));

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_modification");
        assertThat(response.getBody()).containsEntry("reservationId", 99L);
    }

    @Test
    @DisplayName("event=booking_cancellation -> dispatch + 200")
    void dispatchesBookingCancellation() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_cancellation");
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        Reservation r = new Reservation();
        r.setId(7L);
        when(bookingService.handleCancellation(any())).thenReturn(Optional.of(r));

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_cancellation");
    }

    @Test
    @DisplayName("event inconnu (review_received) -> 200 ignored, pas de dispatch booking")
    void ignoresUnknownEvent() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "review_received");
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ignored");
        verify(bookingService, never()).handleNewBooking(any());
        verify(bookingService, never()).handleModification(any());
        verify(bookingService, never()).handleCancellation(any());
    }

    @Test
    @DisplayName("Erreur metier (IllegalStateException: mapping absent) -> 400")
    void mapsBusinessExceptionTo400() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingService.handleNewBooking(any()))
            .thenThrow(new IllegalStateException("Aucun ChannexPropertyMapping pour channex_property_id=unknown"));

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "business_error");
    }

    @Test
    @DisplayName("Erreur technique imprevue (NPE) -> 500 pour que Channex retry")
    void mapsTechnicalExceptionTo500() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingService.handleNewBooking(any()))
            .thenThrow(new RuntimeException("DB connection lost"));

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).containsEntry("error", "internal_error");
    }

    @Test
    @DisplayName("Payload sans event -> 400 missing_event")
    void rejectsMissingEvent() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        String body = """
            { "timestamp": "2026-06-01T10:00:00Z", "property_id": "p", "payload": {} }
            """;

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "missing_event");
    }

    @Test
    @DisplayName("event=booking_new sans payload -> 400 missing_booking_payload")
    void rejectsBookingNewWithoutPayload() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        String body = """
            { "event":"booking_new","property_id":"p","payload": null }
            """;
        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "missing_booking_payload");
    }

    @Test
    @DisplayName("event=booking_modification -> not_found si Optional vide")
    void bookingModificationNotFound() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_modification");
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingService.handleModification(any())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "not_found");
    }

    @Test
    @DisplayName("event=booking_cancellation -> not_found si Optional vide")
    void bookingCancellationNotFound() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_cancellation");
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingService.handleCancellation(any())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "not_found");
    }

    @Test
    @DisplayName("event=non_acked_booking -> re-ack via ChannexClient")
    void nonAckedBookingReAcks() {
        String body = """
            {"event":"non_acked_booking","property_id":"p","payload":{"id":"book-1"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok");
        assertThat(response.getBody()).containsEntry("action", "re_acknowledged");
        verify(channexClient).acknowledgeBooking("book-1");
    }

    @Test
    @DisplayName("event=non_acked_booking sans bookingId -> 400")
    void nonAckedBookingMissingId() {
        String body = """
            {"event":"non_acked_booking","property_id":"p","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "missing_booking_id");
    }

    @Test
    @DisplayName("event=non_acked_booking ack failure -> swallowed 200")
    void nonAckedBookingAckFailureSwallowed() {
        String body = """
            {"event":"non_acked_booking","property_id":"p","payload":{"id":"book-1"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        org.mockito.Mockito.doThrow(new RuntimeException("404"))
            .when(channexClient).acknowledgeBooking("book-1");

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok_swallowed");
    }

    @Test
    @DisplayName("event=sync_error sans property_id -> ignored")
    void syncErrorNoPropertyIdIgnored() {
        String body = """
            {"event":"sync_error","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ignored");
    }

    @Test
    @DisplayName("event=sync_error mapping absent -> ignored 200")
    void syncErrorNoMappingIgnored() {
        String body = """
            {"event":"sync_error","property_id":"chx-unknown","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-unknown"))
            .thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("reason", "no_mapping");
    }

    @Test
    @DisplayName("event=sync_error mapping present -> flagged ERROR + sync_log FAIL")
    void syncErrorMappingFlaggedError() {
        String body = """
            {"event":"sync_error","property_id":"chx-1","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(1L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("chx-1");
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("action", "flagged_error");
        verify(mappingRepository).save(any());
        verify(syncLogService).record(anyLong(), anyLong(), any(), any(), any(),
            org.mockito.ArgumentMatchers.anyInt(), any(), anyString());
    }

    @Test
    @DisplayName("event=message -> route to ChannexMessagingService")
    void messageEventRouted() {
        String body = """
            {"event":"message","property_id":"p","payload":{"thread_id":"t-1","message":"hi"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(messagingService.onChannexMessage(any())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok");
        verify(messagingService).onChannexMessage(any());
    }

    @Test
    @DisplayName("event=review -> 200 OK")
    void reviewEventOk() {
        String body = """
            {"event":"review","property_id":"p","payload":{"id":"r-1","channel":"airbnb"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("reviewId", "r-1");
    }

    @Test
    @DisplayName("event=updated_review -> 200 OK")
    void updatedReviewEventOk() {
        String body = """
            {"event":"updated_review","property_id":"p","payload":{"id":"r-2","channel":"bookingcom"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }
}
