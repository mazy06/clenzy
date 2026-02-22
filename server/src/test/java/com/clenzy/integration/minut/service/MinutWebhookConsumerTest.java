package com.clenzy.integration.minut.service;

import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseDevice;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MinutWebhookConsumerTest {

    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @Mock private NoiseDeviceRepository deviceRepository;
    @Mock private NoiseAlertService noiseAlertService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private MinutWebhookConsumer consumer;

    private NoiseDevice device;

    @BeforeEach
    void setUp() {
        device = new NoiseDevice();
        device.setId(5L);
        device.setOrganizationId(10L);
        device.setPropertyId(100L);
        device.setExternalDeviceId("minut-abc-123");
    }

    @Test
    void whenDisturbanceEvent_thenEvaluatesNoiseLevel() {
        String payload = """
            {"event_type": "disturbance", "device_id": "minut-abc-123", "sound_level": 82.5}
            """;

        when(deviceRepository.findByExternalDeviceId("minut-abc-123"))
            .thenReturn(Optional.of(device));

        consumer.handleMinutWebhook(payload);

        verify(noiseAlertService).evaluateNoiseLevel(
            eq(10L), eq(100L), eq(5L), eq(82.5), eq(AlertSource.WEBHOOK));
    }

    @Test
    void whenNonDisturbanceEvent_thenIgnored() {
        String payload = """
            {"event_type": "device_offline", "device_id": "minut-abc-123"}
            """;

        consumer.handleMinutWebhook(payload);

        verifyNoInteractions(noiseAlertService);
    }

    @Test
    void whenUnknownDevice_thenSkipped() {
        String payload = """
            {"event_type": "disturbance", "device_id": "unknown-device", "sound_level": 80.0}
            """;

        when(deviceRepository.findByExternalDeviceId("unknown-device"))
            .thenReturn(Optional.empty());

        consumer.handleMinutWebhook(payload);

        verifyNoInteractions(noiseAlertService);
    }

    @Test
    void whenInvalidPayload_thenHandledGracefully() {
        String payload = "not-valid-json{{{";

        // Should not throw
        consumer.handleMinutWebhook(payload);

        verifyNoInteractions(noiseAlertService);
    }

    @Test
    void whenDisturbanceInNestedData_thenExtractsCorrectly() {
        String payload = """
            {"event_type": "disturbance", "data": {"device_id": "minut-abc-123", "sound_level": 78.0}}
            """;

        when(deviceRepository.findByExternalDeviceId("minut-abc-123"))
            .thenReturn(Optional.of(device));

        consumer.handleMinutWebhook(payload);

        verify(noiseAlertService).evaluateNoiseLevel(
            eq(10L), eq(100L), eq(5L), eq(78.0), eq(AlertSource.WEBHOOK));
    }
}
