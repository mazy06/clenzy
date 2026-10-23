package com.clenzy.integration.minut.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.config.KafkaConfig;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseDevice;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.device.DeviceRealtimePublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyMinutConsumerPrivacyTest {
    private static final String PRIVATE = "synthetic-private-device guest@example.invalid";
    private final ObjectMapper mapper = new ObjectMapper();
    private final NoiseDeviceRepository devices = mock(NoiseDeviceRepository.class);
    private final NoiseAlertService noise = mock(NoiseAlertService.class);
    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
    private final AutomationEngine automation = mock(AutomationEngine.class);
    private final DeviceRealtimePublisher realtime = mock(DeviceRealtimePublisher.class);
    private final MinutWebhookConsumer consumer = new MinutWebhookConsumer(mapper, devices, noise, kafka, automation, realtime);
    private final Logger logger = (Logger) LoggerFactory.getLogger(MinutWebhookConsumer.class);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private Level initialLevel;

    @BeforeEach
    void captureAllLevels() {
        initialLevel = logger.getLevel();
        logger.setLevel(Level.DEBUG);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void diagnosticsNeverContainPrivateData() {
        try {
            assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private", "example.invalid", "83.5");
                assertThat(event.getThrowableProxy()).isNull();
                if (event.getArgumentArray() != null) {
                    assertThat(Arrays.toString(event.getArgumentArray())).doesNotContain(PRIVATE);
                }
            });
        } finally {
            logger.detachAppender(logs);
            logger.setLevel(initialLevel);
            logs.stop();
        }
    }

    private NoiseDevice device() {
        var device = new NoiseDevice();
        device.setId(31L);
        device.setOrganizationId(71L);
        device.setPropertyId(91L);
        device.setExternalDeviceId(PRIVATE);
        device.setName(PRIVATE);
        when(devices.findByExternalDeviceId(PRIVATE)).thenReturn(Optional.of(device));
        return device;
    }

    private String payload(String type, Object level) throws Exception {
        return mapper.writeValueAsString(Map.of("event_type", type, "device_id", PRIVATE, "sound_level", level));
    }

    private RuntimeException failure() {
        var error = new IllegalStateException(PRIVATE, new RuntimeException(PRIVATE));
        error.addSuppressed(new RuntimeException(PRIVATE));
        return error;
    }

    @ParameterizedTest
    @ValueSource(strings = {"NaN", "Infinity", "-Infinity", "1e309", "0", "-1"})
    void invalidLevelCannotTriggerNoiseAlertOrDownstreamEvent(String value) throws Exception {
        device();
        consumer.handleMinutWebhook(payload("disturbance", value));
        verifyNoInteractions(noise, kafka, automation, realtime);
    }

    @Test
    void validLevelPreservesBusinessEvaluationAndEventPayload() throws Exception {
        device();
        consumer.handleMinutWebhook(payload("disturbance", 83.5));
        verify(noise).evaluateNoiseLevel(71L, 91L, 31L, 83.5, AlertSource.WEBHOOK);
        verify(kafka).send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS), argThat((Object value) -> {
            var event = (Map<?, ?>) value;
            return event.get("deviceId").equals(31L) && event.get("soundLevel").equals(83.5);
        }));
    }

    @Test
    void signedButMalformedPayloadDoesNotLeakParserContext() {
        consumer.handleMinutWebhook("{\"event_type\":\"" + PRIVATE);
        verifyNoInteractions(devices, noise, kafka, automation, realtime);
    }

    @Test
    void unknownTypeIsNeverCopiedIntoDebugLogs() throws Exception {
        consumer.handleMinutWebhook(payload(PRIVATE, 83.5));
        verifyNoInteractions(devices, noise, kafka, automation, realtime);
    }

    @Test
    void unknownDeviceIsNotCopiedIntoDebugLogs() throws Exception {
        when(devices.findByExternalDeviceId(PRIVATE)).thenReturn(Optional.empty());
        consumer.handleMinutWebhook(payload("disturbance", 83.5));
        verifyNoInteractions(noise, kafka, automation, realtime);
    }

    @ParameterizedTest
    @ValueSource(strings = {"repository", "evaluation", "publication"})
    void failuresDropPrivateMessageCauseAndSuppressedData(String stage) throws Exception {
        if (stage.equals("repository")) {
            when(devices.findByExternalDeviceId(PRIVATE)).thenThrow(failure());
        } else {
            device();
            if (stage.equals("evaluation")) when(noise.evaluateNoiseLevel(anyLong(), anyLong(), anyLong(), anyDouble(), any()))
                    .thenThrow(failure());
            else when(kafka.send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS), any())).thenThrow(failure());
        }
        consumer.handleMinutWebhook(payload("disturbance", 83.5));
        if (!stage.equals("publication")) verifyNoInteractions(kafka);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void offlineEpisodeStillUsesCompareAndSetBeforeNotification(boolean changed) throws Exception {
        device();
        when(devices.markOffline(31L)).thenReturn(changed ? 1 : 0);
        consumer.handleMinutWebhook(payload("device_offline", 0));
        verify(devices).markOffline(31L);
        if (changed) {
            verify(realtime).publishDeviceChanged(71L, "noise", 31L, "hors ligne");
            verify(automation).fireTrigger(eq(AutomationTrigger.IOT_DEVICE_OFFLINE), eq(71L),
                    argThat(subject -> subject.data().containsValue(PRIVATE)));
        } else verifyNoInteractions(realtime, automation);
        verifyNoInteractions(noise, kafka);
    }

    @Test
    void onlineTransitionPreservesRealtimeUpdateWithoutPrivateLogs() throws Exception {
        device();
        consumer.handleMinutWebhook(payload("device_online", 0));
        verify(devices).markOnline(eq(31L), any());
        verify(realtime).publishDeviceChanged(71L, "noise", 31L, "de retour en ligne");
        verifyNoInteractions(automation, noise, kafka);
    }
}
