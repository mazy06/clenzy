package com.clenzy.integration.expedia.service;

import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpediaWebhookServiceTest {

    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private ExpediaConfig config;

    private ObjectMapper objectMapper;
    private ExpediaWebhookService service;

    private static final String WEBHOOK_SECRET = "test-secret-key";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ExpediaWebhookService(kafkaTemplate, config, objectMapper);
    }

    private String computeHmac(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                    WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ===== VALIDATE SIGNATURE =====

    @Nested
    @DisplayName("Signature validation")
    class SignatureValidation {

        @Test
        @DisplayName("returns true for valid HMAC signature")
        void validateSignature_valid_returnsTrue() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-1\",\"event_type\":\"reservation.created\"}";
            String signature = computeHmac(payload);

            @SuppressWarnings("unchecked")
            CompletableFuture future = CompletableFuture.completedFuture(null);
            when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false for invalid HMAC signature")
        void validateSignature_invalid_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-1\",\"event_type\":\"reservation.created\"}";
            String invalidSignature = "0000000000000000000000000000000000000000000000000000000000000000";

            boolean result = service.processWebhook(payload, invalidSignature);

            assertThat(result).isFalse();
            verifyNoInteractions(kafkaTemplate);
        }
    }

    // ===== TOPIC ROUTING =====

    @Nested
    @DisplayName("Topic routing")
    class TopicRouting {

        @Test
        @DisplayName("routes reservation events to reservations topic")
        void processWebhook_reservationEvent_routesToReservationsTopic() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-1\",\"event_type\":\"reservation.created\",\"data\":{}}";
            String signature = computeHmac(payload);

            @SuppressWarnings("unchecked")
            CompletableFuture future = CompletableFuture.completedFuture(null);
            when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
            verify(kafkaTemplate).send(eq("expedia.reservations.sync"), eq("evt-1"), any());
        }

        @Test
        @DisplayName("routes availability events to calendar topic")
        void processWebhook_availabilityEvent_routesToCalendarTopic() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-2\",\"event_type\":\"availability.updated\",\"data\":{}}";
            String signature = computeHmac(payload);

            @SuppressWarnings("unchecked")
            CompletableFuture future = CompletableFuture.completedFuture(null);
            when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
            verify(kafkaTemplate).send(eq("expedia.calendar.sync"), eq("evt-2"), any());
        }

        @Test
        @DisplayName("routes unknown events to DLQ")
        void processWebhook_unknownEvent_routesToDlq() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-3\",\"event_type\":\"unknown.type\",\"data\":{}}";
            String signature = computeHmac(payload);

            @SuppressWarnings("unchecked")
            CompletableFuture future = CompletableFuture.completedFuture(null);
            when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
            verify(kafkaTemplate).send(eq("expedia.dlq"), eq("evt-3"), any());
        }
    }

    // ===== DEDUPLICATION =====

    @Nested
    @DisplayName("Event deduplication")
    class Deduplication {

        @Test
        @DisplayName("skips duplicate events that were already processed")
        void processWebhook_duplicateEvent_skips() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            String payload = "{\"event_id\":\"evt-dup\",\"event_type\":\"reservation.created\",\"data\":{}}";
            String signature = computeHmac(payload);

            @SuppressWarnings("unchecked")
            CompletableFuture future = CompletableFuture.completedFuture(null);
            when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

            // First call processes the event
            service.processWebhook(payload, signature);

            // Mark as processed (simulating the whenComplete callback)
            service.markAsProcessed("evt-dup");

            // Reset to track second call
            reset(kafkaTemplate);

            // Second call with same event_id should skip
            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
            verifyNoInteractions(kafkaTemplate);
        }
    }

    // ===== MISSING SECRET =====

    @Nested
    @DisplayName("Missing webhook secret")
    class MissingSecret {

        @Test
        @DisplayName("rejects webhook when secret is not configured")
        void processWebhook_missingSecret_returnsFalse() {
            when(config.getWebhookSecret()).thenReturn("");

            String payload = "{\"event_id\":\"evt-1\",\"event_type\":\"reservation.created\"}";

            boolean result = service.processWebhook(payload, "some-signature");

            assertThat(result).isFalse();
            verifyNoInteractions(kafkaTemplate);
        }
    }
}
