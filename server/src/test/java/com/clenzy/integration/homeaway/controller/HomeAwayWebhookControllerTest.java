package com.clenzy.integration.homeaway.controller;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.homeaway.service.HomeAwaySyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HomeAwayWebhookController}.
 *
 * Covers signature validation paths, event routing for each known event type,
 * unknown events, missing payload pieces, and orgId resolution.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HomeAwayWebhookController")
class HomeAwayWebhookControllerTest {

    @Mock private HomeAwayConfig config;
    @Mock private HomeAwayConnectionRepository connectionRepository;
    @Mock private HomeAwaySyncService syncService;

    private HomeAwayWebhookController controller;

    private static final String WEBHOOK_SECRET = "super-secret";

    @BeforeEach
    void setUp() {
        controller = new HomeAwayWebhookController(config, connectionRepository, syncService);
    }

    private String sign(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private HomeAwayConnection conn(Long orgId, String listingId) {
        HomeAwayConnection c = new HomeAwayConnection();
        c.setId(1L);
        c.setOrganizationId(orgId);
        c.setListingId(listingId);
        return c;
    }

    // ─── Signature validation ──────────────────────────────────────────────

    @Nested
    @DisplayName("signature validation")
    class SignatureValidation {

        @Test
        @DisplayName("invalid signature returns 400")
        void invalidSignature() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{}}";

            ResponseEntity<Map<String, String>> resp =
                    controller.receiveWebhook(payload, "deadbeef");

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(resp.getBody()).containsEntry("status", "error");
            verify(syncService, never()).handleReservationCreated(any(), anyLong());
        }

        @Test
        @DisplayName("null signature returns 400 when secret configured")
        void nullSignature() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            String payload = "{}";

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("no secret configured -> bypasses signature check")
        void noSecretConfigured_bypasses() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(7L, "L-1")));

            ResponseEntity<Map<String, String>> resp =
                    controller.receiveWebhook(payload, "anything");

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(syncService).handleReservationCreated(any(), eq(7L));
        }

        @Test
        @DisplayName("empty secret -> bypasses signature check")
        void emptySecret_bypasses() {
            when(config.getWebhookSecret()).thenReturn("");
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(1L, "L-1")));

            ResponseEntity<Map<String, String>> resp =
                    controller.receiveWebhook(payload, "any");

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("valid signature passes")
        void validSignature() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"L-1\"}}";
            String sig = sign(payload, WEBHOOK_SECRET);
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(5L, "L-1")));

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, sig);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(syncService).handleReservationCreated(any(), eq(5L));
        }
    }

    // ─── Event routing ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("event routing")
    class EventRouting {

        @Test
        @DisplayName("reservation.created routes to handleReservationCreated")
        void routesCreated() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(10L, "L-1")));

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(syncService).handleReservationCreated(any(), eq(10L));
        }

        @Test
        @DisplayName("reservation.updated routes to handleReservationUpdated")
        void routesUpdated() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.updated\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(10L, "L-1")));

            controller.receiveWebhook(payload, null);

            verify(syncService).handleReservationUpdated(any(), eq(10L));
        }

        @Test
        @DisplayName("reservation.cancelled routes to handleReservationCancelled")
        void routesCancelled() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.cancelled\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(10L, "L-1")));

            controller.receiveWebhook(payload, null);

            verify(syncService).handleReservationCancelled(any(), eq(10L));
        }

        @Test
        @DisplayName("availability.updated routes to handleAvailabilityUpdate")
        void routesAvailability() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"availability.updated\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(10L, "L-1")));

            controller.receiveWebhook(payload, null);

            verify(syncService).handleAvailabilityUpdate(any(), eq(10L));
        }

        @Test
        @DisplayName("unknown event type is logged but returns OK")
        void unknownEventType() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"unknown.event\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(10L, "L-1")));

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(syncService, never()).handleReservationCreated(any(), anyLong());
        }
    }

    // ─── Validation errors / edge cases ────────────────────────────────────

    @Nested
    @DisplayName("edge cases")
    class EdgeCases {

        @Test
        @DisplayName("missing event_type returns 400")
        void missingEventType() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"data\":{\"listing_id\":\"L-1\"}}";

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(resp.getBody()).containsEntry("status", "error");
        }

        @Test
        @DisplayName("missing data returns 400")
        void missingData() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\"}";

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("listing not linked -> 200 with 'ignored' message")
        void listingNotLinked() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"UNKNOWN\"}}";
            when(connectionRepository.findByListingId("UNKNOWN"))
                    .thenReturn(Optional.empty());

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).containsEntry("status", "ok");
            assertThat(resp.getBody().get("message")).contains("not linked");
            verify(syncService, never()).handleReservationCreated(any(), anyLong());
        }

        @Test
        @DisplayName("null listing_id -> 200 with 'ignored' message")
        void nullListingId() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{}}";

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(syncService, never()).handleReservationCreated(any(), anyLong());
        }

        @Test
        @DisplayName("malformed JSON returns 200 (caught by general exception handler)")
        void malformedJson() {
            when(config.getWebhookSecret()).thenReturn(null);

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook("not json", null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("message")).contains("processing failed");
        }

        @Test
        @DisplayName("downstream sync exception returns 200")
        void downstreamThrows() {
            when(config.getWebhookSecret()).thenReturn(null);
            String payload = "{\"event_type\":\"reservation.created\",\"data\":{\"listing_id\":\"L-1\"}}";
            when(connectionRepository.findByListingId("L-1"))
                    .thenReturn(Optional.of(conn(1L, "L-1")));
            org.mockito.Mockito.doThrow(new RuntimeException("kafka down"))
                    .when(syncService).handleReservationCreated(any(), eq(1L));

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(payload, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("message")).contains("processing failed");
        }

        @Test
        @DisplayName("null payload + no secret -> 200 (catches exception)")
        void nullPayloadNoSecret() {
            when(config.getWebhookSecret()).thenReturn(null);

            ResponseEntity<Map<String, String>> resp = controller.receiveWebhook(null, null);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("message")).contains("processing failed");
        }
    }
}
