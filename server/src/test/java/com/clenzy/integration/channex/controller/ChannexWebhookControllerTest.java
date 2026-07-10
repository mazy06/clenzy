package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channex.service.ChannexBookingFeedService;
import com.clenzy.integration.channex.service.ChannexMessagingService;
import com.clenzy.integration.channex.service.ChannexSyncLogService;
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

/**
 * Les webhooks booking_* sont des DECLENCHEURS de drain du feed de revisions
 * (doc Channex) : le controller ne persiste plus le payload embarque, il
 * delegue a {@link ChannexBookingFeedService#processFeed()}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexWebhookController")
class ChannexWebhookControllerTest {

    @Mock private ChannexSignatureValidator signatureValidator;
    @Mock private ChannexBookingFeedService bookingFeedService;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexSyncLogService syncLogService;
    @Mock private ChannexMessagingService messagingService;
    @Mock private com.clenzy.integration.channex.service.ChannexChannelEventService channelEventService;

    private ObjectMapper objectMapper;
    private ChannexWebhookController controller;

    private static final ChannexBookingFeedService.FeedProcessingResult ONE_ACKED =
        new ChannexBookingFeedService.FeedProcessingResult(1, 1, 0, false);

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
        // Service sync-error reel sur repository mocke + syncLogService mocke (refactor T-ARCH-01)
        controller = new ChannexWebhookController(signatureValidator, bookingFeedService, objectMapper,
            new ChannexMetrics(new SimpleMeterRegistry()),
            new com.clenzy.integration.channex.service.ChannexSyncErrorService(mappingRepository, syncLogService),
            messagingService, channelEventService);
    }

    @Test
    @DisplayName("Signature invalide -> 401 + feed non draine")
    void rejectsInvalidSignature() {
        when(signatureValidator.isValid(anyString())).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-invalid", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).containsEntry("error", "invalid_token");
        verify(bookingFeedService, never()).processFeed();
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
    @DisplayName("Payload JSON malforme -> 400 + feed non draine")
    void rejectsMalformedPayload() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", "{ broken json"
        );

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "malformed_payload");
        verify(bookingFeedService, never()).processFeed();
    }

    @Test
    @DisplayName("event=booking_new -> drain du feed + 200 avec compteurs")
    void dispatchesBookingNew() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook(
            "sig-ok", VALID_NEW_BOOKING_BODY
        );

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_new");
        assertThat(response.getBody()).containsEntry("revisionsProcessed", 1);
        assertThat(response.getBody()).containsEntry("revisionsAcked", 1);
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=booking_modification -> drain du feed + 200")
    void dispatchesBookingModification() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_modification");
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_modification");
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=booking_cancellation -> drain du feed + 200")
    void dispatchesBookingCancellation() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_cancellation");
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("event", "booking_cancellation");
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=booking_new SANS payload embarque -> drain quand meme (200)")
    void bookingNewWithoutPayloadStillDrainsFeed() {
        // send_data=false cote Channex : le webhook n'embarque pas la revision,
        // le feed reste la source de verite — le drain doit avoir lieu.
        String body = """
            { "event":"booking_new","property_id":"p","payload": null }
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=non_acked_booking -> drain du feed (rattrapage)")
    void nonAckedBookingDrainsFeed() {
        String body = """
            {"event":"non_acked_booking","property_id":"p","payload":{"id":"book-1"}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok");
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=booking_unmapped_room -> notification + drain du feed (resa persistee quand meme)")
    void unmappedRoomNotifiesAndDrains() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "booking_unmapped_room");
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(channelEventService.onUnmappedBooking("channex-prop-1", "booking_unmapped_room"))
            .thenReturn(true);
        when(bookingFeedService.processFeed()).thenReturn(ONE_ACKED);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("notified", true);
        verify(channelEventService).onUnmappedBooking("channex-prop-1", "booking_unmapped_room");
        verify(bookingFeedService).processFeed();
    }

    @Test
    @DisplayName("event=disconnect_channel -> notification cycle de vie + 200")
    void channelLifecycleRouted() {
        String body = """
            {"event":"disconnect_channel","property_id":"channex-prop-1","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(channelEventService.onChannelLifecycleEvent("channex-prop-1", "disconnect_channel"))
            .thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("action", "notified");
    }

    @Test
    @DisplayName("event=reservation_request (Airbnb) mapping absent -> 200 ignored")
    void airbnbEventNoMappingIgnored() {
        String body = """
            {"event":"reservation_request","property_id":"chx-unknown","payload":{}}
            """;
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(channelEventService.onAirbnbEvent("chx-unknown", "reservation_request"))
            .thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ignored");
    }

    @Test
    @DisplayName("event inconnu (review_received) -> 200 ignored, pas de drain")
    void ignoresUnknownEvent() {
        String body = VALID_NEW_BOOKING_BODY.replace("booking_new", "review_received");
        when(signatureValidator.isValid(anyString())).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.handleWebhook("sig-ok", body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ignored");
        verify(bookingFeedService, never()).processFeed();
    }

    @Test
    @DisplayName("Erreur metier (IllegalStateException) -> 400")
    void mapsBusinessExceptionTo400() {
        when(signatureValidator.isValid(anyString())).thenReturn(true);
        when(bookingFeedService.processFeed())
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
        when(bookingFeedService.processFeed())
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
