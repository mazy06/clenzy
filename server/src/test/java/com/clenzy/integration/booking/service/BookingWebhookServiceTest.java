package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingWebhookPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingWebhookServiceTest {

    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private BookingConfig config;

    private BookingWebhookService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String WEBHOOK_SECRET = "test-webhook-secret-key";
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new BookingWebhookService(kafkaTemplate, config, objectMapper);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private String computeHmac(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKey);
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    // ================================================================
    // validateWebhookSignature
    // ================================================================

    @Nested
    @DisplayName("validateWebhookSignature")
    class ValidateWebhookSignature {

        @Test
        @DisplayName("valid signature returns true")
        void validateWebhookSignature_validSignature_returnsTrue() throws Exception {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"eventType\":\"reservation.created\"}";
            String signature = computeHmac(payload, WEBHOOK_SECRET);

            boolean result = service.validateWebhookSignature(signature, payload);

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("invalid signature returns false")
        void validateWebhookSignature_invalidSignature_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"eventType\":\"reservation.created\"}";
            String badSignature = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567";

            boolean result = service.validateWebhookSignature(badSignature, payload);

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("null signature returns false")
        void validateWebhookSignature_nullSignature_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            boolean result = service.validateWebhookSignature(null, "{\"data\":\"test\"}");

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("empty webhook secret returns false")
        void validateWebhookSignature_emptySecret_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn("");

            boolean result = service.validateWebhookSignature("some-sig", "{\"data\":\"test\"}");

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("null webhook secret returns false")
        void validateWebhookSignature_nullSecret_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn(null);

            boolean result = service.validateWebhookSignature("some-sig", "{\"data\":\"test\"}");

            assertThat(result).isFalse();
        }
    }

    // ================================================================
    // processWebhook
    // ================================================================

    @Nested
    @DisplayName("processWebhook")
    class ProcessWebhook {

        @BeforeEach
        void setUpKafka() {
            // kafkaTemplate.send returns a CompletableFuture
            lenient().when(kafkaTemplate.send(anyString(), anyString(), any()))
                    .thenReturn(new CompletableFuture<>());
        }

        @Test
        @DisplayName("reservation event publishes to reservations topic")
        void processWebhook_reservationEvent_publishesToReservationsTopic() {
            var payload = new BookingWebhookPayload(
                    "reservation.created", "HOTEL-1", "RES-123",
                    Map.of("guest_name", "Jean Dupont"), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), keyCaptor.capture(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.reservations");
            assertThat(keyCaptor.getValue()).isEqualTo("RES-123");
        }

        @Test
        @DisplayName("availability event publishes to calendar topic")
        void processWebhook_availabilityEvent_publishesToCalendarTopic() {
            var payload = new BookingWebhookPayload(
                    "availability.updated", "HOTEL-1", null,
                    Map.of("room_id", "101"), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.calendar.sync");
        }

        @Test
        @DisplayName("rates event publishes to calendar topic")
        void processWebhook_ratesEvent_publishesToCalendarTopic() {
            var payload = new BookingWebhookPayload(
                    "rates.updated", "HOTEL-1", null,
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.calendar.sync");
        }

        @Test
        @DisplayName("restrictions event publishes to calendar topic")
        void processWebhook_restrictionsEvent_publishesToCalendarTopic() {
            var payload = new BookingWebhookPayload(
                    "restrictions.updated", "HOTEL-1", null,
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.calendar.sync");
        }

        @Test
        @DisplayName("unknown event type defaults to reservations topic")
        void processWebhook_unknownEvent_defaultsToReservationsTopic() {
            var payload = new BookingWebhookPayload(
                    "unknown.event.type", "HOTEL-1", "RES-456",
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.reservations");
        }

        @Test
        @DisplayName("null event type defaults to reservations topic")
        void processWebhook_nullEventType_defaultsToReservationsTopic() {
            var payload = new BookingWebhookPayload(
                    null, "HOTEL-1", "RES-789",
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), any());

            assertThat(topicCaptor.getValue()).isEqualTo("booking.reservations");
        }

        @Test
        @DisplayName("uses reservationId as Kafka key when present")
        void processWebhook_usesReservationIdAsKey() {
            var payload = new BookingWebhookPayload(
                    "reservation.modified", "HOTEL-1", "RES-KEY-TEST",
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(anyString(), keyCaptor.capture(), any());

            assertThat(keyCaptor.getValue()).isEqualTo("RES-KEY-TEST");
        }

        @Test
        @DisplayName("uses hotelId as Kafka key when no reservationId")
        void processWebhook_usesHotelIdAsKeyWhenNoReservation() {
            var payload = new BookingWebhookPayload(
                    "availability.updated", "HOTEL-FALLBACK", null,
                    Map.of(), "2026-02-27T10:00:00Z");

            service.processWebhook(payload, ORG_ID);

            ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            verify(kafkaTemplate).send(anyString(), keyCaptor.capture(), any());

            assertThat(keyCaptor.getValue()).isEqualTo("HOTEL-FALLBACK");
        }
    }
}
