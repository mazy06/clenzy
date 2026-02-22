package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbWebhookEvent;
import com.clenzy.integration.airbnb.repository.AirbnbWebhookEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AirbnbWebhookServiceTest {

    @Mock private AirbnbWebhookEventRepository webhookEventRepository;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private AirbnbConfig config;

    private AirbnbWebhookService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String WEBHOOK_SECRET = "test-secret-key";

    @BeforeEach
    void setUp() {
        service = new AirbnbWebhookService(webhookEventRepository, kafkaTemplate, config, objectMapper);
    }

    private String computeHmac(String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec key = new SecretKeySpec(WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(key);
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    // ===== PROCESS WEBHOOK =====

    @Nested
    class ProcessWebhook {

        @Test
        void whenNoWebhookSecret_thenReturnsFalse() {
            when(config.getWebhookSecret()).thenReturn(null);

            boolean result = service.processWebhook("{}", "some-sig");

            assertThat(result).isFalse();
            verify(webhookEventRepository, never()).save(any());
        }

        @Test
        void whenEmptyWebhookSecret_thenReturnsFalse() {
            when(config.getWebhookSecret()).thenReturn("");

            boolean result = service.processWebhook("{}", "some-sig");

            assertThat(result).isFalse();
        }

        @Test
        void whenInvalidSignature_thenReturnsFalse() {
            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            boolean result = service.processWebhook(
                    "{\"event_id\":\"e1\",\"event_type\":\"reservation.created\"}",
                    "invalid-signature");

            assertThat(result).isFalse();
            verify(webhookEventRepository, never()).save(any());
        }

        @Test
        void whenDuplicateEvent_thenReturnsTrue() throws Exception {
            String payload = "{\"event_id\":\"dup-1\",\"event_type\":\"reservation.created\"}";
            String signature = computeHmac(payload);

            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            when(webhookEventRepository.findByEventId("dup-1"))
                    .thenReturn(Optional.of(new AirbnbWebhookEvent()));

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();
            verify(webhookEventRepository, never()).save(any());
        }

        @Test
        void whenValidReservationEvent_thenSavesAndPublishesToReservationsTopic() throws Exception {
            String payload = "{\"event_id\":\"evt-1\",\"event_type\":\"reservation.created\",\"data\":{}}";
            String signature = computeHmac(payload);

            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            when(webhookEventRepository.findByEventId("evt-1")).thenReturn(Optional.empty());
            when(kafkaTemplate.send(anyString(), anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isTrue();

            ArgumentCaptor<AirbnbWebhookEvent> captor = ArgumentCaptor.forClass(AirbnbWebhookEvent.class);
            verify(webhookEventRepository).save(captor.capture());
            AirbnbWebhookEvent saved = captor.getValue();
            assertThat(saved.getEventId()).isEqualTo("evt-1");
            assertThat(saved.getEventType()).isEqualTo("reservation.created");
            assertThat(saved.getStatus()).isEqualTo(AirbnbWebhookEvent.WebhookEventStatus.PENDING);

            verify(kafkaTemplate).send(eq(KafkaConfig.TOPIC_AIRBNB_RESERVATIONS), eq("evt-1"), any());
        }

        @Test
        void whenCalendarEvent_thenPublishesToCalendarTopic() throws Exception {
            String payload = "{\"event_id\":\"evt-2\",\"event_type\":\"calendar.updated\"}";
            String signature = computeHmac(payload);

            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);
            when(webhookEventRepository.findByEventId("evt-2")).thenReturn(Optional.empty());
            when(kafkaTemplate.send(anyString(), anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.processWebhook(payload, signature);

            verify(kafkaTemplate).send(eq(KafkaConfig.TOPIC_AIRBNB_CALENDAR), eq("evt-2"), any());
        }

        @Test
        void whenMissingEventId_thenReturnsFalse() throws Exception {
            String payload = "{\"event_type\":\"reservation.created\"}";
            String signature = computeHmac(payload);

            when(config.getWebhookSecret()).thenReturn(WEBHOOK_SECRET);

            boolean result = service.processWebhook(payload, signature);

            assertThat(result).isFalse();
        }
    }

    // ===== MARK AS PROCESSED =====

    @Nested
    class MarkAsProcessed {

        @Test
        void whenEventExists_thenUpdatesStatus() {
            AirbnbWebhookEvent event = new AirbnbWebhookEvent();
            event.setStatus(AirbnbWebhookEvent.WebhookEventStatus.PENDING);
            when(webhookEventRepository.findByEventId("evt-1")).thenReturn(Optional.of(event));

            service.markAsProcessed("evt-1");

            assertThat(event.getStatus()).isEqualTo(AirbnbWebhookEvent.WebhookEventStatus.PROCESSED);
            assertThat(event.getProcessedAt()).isNotNull();
            verify(webhookEventRepository).save(event);
        }

        @Test
        void whenEventNotFound_thenDoesNothing() {
            when(webhookEventRepository.findByEventId("unknown")).thenReturn(Optional.empty());

            service.markAsProcessed("unknown");

            verify(webhookEventRepository, never()).save(any());
        }
    }

    // ===== MARK AS FAILED =====

    @Nested
    class MarkAsFailed {

        @Test
        void whenEventExists_thenSetsFailedAndIncrementsRetry() {
            AirbnbWebhookEvent event = new AirbnbWebhookEvent();
            event.setRetryCount(2);
            when(webhookEventRepository.findByEventId("evt-1")).thenReturn(Optional.of(event));

            service.markAsFailed("evt-1", "Processing error");

            assertThat(event.getStatus()).isEqualTo(AirbnbWebhookEvent.WebhookEventStatus.FAILED);
            assertThat(event.getErrorMessage()).isEqualTo("Processing error");
            assertThat(event.getRetryCount()).isEqualTo(3);
            verify(webhookEventRepository).save(event);
        }
    }
}
