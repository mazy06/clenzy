package com.clenzy.integration;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.integration.channel.DeterministicFlowListener;
import com.clenzy.integration.nuki.controller.NukiWebhookController;
import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.integration.nuki.service.NukiWebhookService;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.CreateMaintenanceInterventionExecutor;
import com.clenzy.service.automation.NotifyStaffExecutor;
import com.clenzy.service.device.DeviceRealtimePublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Synthetic private values remain in business calls, never in these operational logs. */
class BaitlyCalendarNukiDiagnosticsPrivacyTest {
    private static final String PRIVATE = "synthetic-person@example.invalid PIN=135790 token=synthetic-private\nFORGED_LOG";
    private static final long ORG = 730001, PROPERTY = 830002, RESOURCE = 930003;
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Map<Logger, Level> originalLevels = new HashMap<>();
    private final AutomationEngine engine = mock(AutomationEngine.class);
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach void captureIncludingDebug() {
        logs.start();
        for (Class<?> type : List.of(DeterministicFlowListener.class, NukiWebhookController.class, NukiWebhookService.class)) {
            var logger = (Logger) LoggerFactory.getLogger(type);
            originalLevels.put(logger, logger.getLevel());
            logger.setLevel(Level.DEBUG);
            logger.addAppender(logs);
        }
    }

    @AfterEach void noPrivateDiagnosticsAndRestoreLoggers() {
        try {
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(PRIVATE, "example.invalid", "135790", "synthetic-private",
                    "FORGED_LOG", Long.toString(ORG), Long.toString(PROPERTY), Long.toString(RESOURCE));
                assertThat(event.getArgumentArray()).isNull();
                assertThat(event.getThrowableProxy()).isNull();
                assertThat(event.getKeyValuePairs()).isNullOrEmpty();
            });
        } finally {
            originalLevels.forEach((logger, level) -> { logger.detachAppender(logs); logger.setLevel(level); });
            logs.stop();
        }
    }

    private RuntimeException failure() {
        var failure = new IllegalStateException(PRIVATE, new IllegalArgumentException(PRIVATE));
        failure.addSuppressed(new RuntimeException(PRIVATE));
        return failure;
    }

    private Map<String, Object> calendarEvent() {
        return new HashMap<>(Map.of("action", "BOOKED", "orgId", ORG, "propertyId", PROPERTY,
            "reservationId", RESOURCE, "from", PRIVATE, "to", PRIVATE, "guest", PRIVATE));
    }

    @ParameterizedTest @ValueSource(strings = {"map", "json", "record"})
    void calendarRelaysTheSameBusinessDataWithoutLoggingIt(String format) throws Exception {
        var listener = new DeterministicFlowListener(engine, json);
        var event = calendarEvent();
        Object payload = switch (format) {
            case "json" -> json.writeValueAsString(event);
            case "record" -> new ConsumerRecord<>("synthetic-calendar", 0, 0, PRIVATE, json.writeValueAsString(event));
            default -> event;
        };
        listener.onCalendarUpdate(payload);
        var subject = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(engine).fireTrigger(eq(AutomationTrigger.RESERVATION_BOOKED), eq(ORG), subject.capture());
        verifyNoMoreInteractions(engine);
        assertThat(subject.getValue().subjectId()).isEqualTo(RESOURCE);
        assertThat(subject.getValue().data()).containsEntry(AutomationSubject.DATA_PROPERTY_ID, PROPERTY)
            .containsEntry(AutomationSubject.DATA_CHECK_IN, PRIVATE).containsEntry(AutomationSubject.DATA_CHECK_OUT, PRIVATE);
        assertThat(logs.list).hasSize(1);
    }

    @ParameterizedTest @ValueSource(strings = {"unknown", "missingAction", "scope", "reservation", "malformed", "unsupported"})
    void ignoredCalendarInputsRemainIgnoredAndNeverAppearInLogs(String kind) {
        var listener = new DeterministicFlowListener(engine, json);
        var event = calendarEvent();
        Object payload = event;
        switch (kind) {
            case "unknown" -> event.put("action", PRIVATE);
            case "missingAction" -> event.remove("action");
            case "scope" -> event.put("orgId", PRIVATE);
            case "reservation" -> event.remove("reservationId");
            case "malformed" -> payload = "{\"private\":\"" + PRIVATE;
            case "unsupported" -> payload = new Object() { @Override public String toString() { throw new AssertionError("Not a diagnostic"); } };
            default -> throw new AssertionError(kind);
        }
        listener.onCalendarUpdate(payload);
        verifyNoInteractions(engine);
        assertThat(logs.list).isNotEmpty();
    }

    @Test void calendarFailureStillReachesKafkaWithoutASecondCallOrLocalThrowableLog() {
        var failure = failure();
        doThrow(failure).when(engine).fireTrigger(any(), anyLong(), any());
        assertThatThrownBy(() -> new DeterministicFlowListener(engine, json).onCalendarUpdate(calendarEvent())).isSameAs(failure);
        verify(engine).fireTrigger(eq(AutomationTrigger.RESERVATION_BOOKED), eq(ORG), any());
        verifyNoMoreInteractions(engine);
        assertThat(logs.list).hasSize(1);
    }

    private NukiConnection connection() {
        var connection = new NukiConnection(); connection.setOrganizationId(ORG); connection.setWebhookSecret(PRIVATE);
        return connection;
    }
    private Map<String, Object> nukiPayload() {
        return new HashMap<>(Map.of("nukiId", PRIVATE, "state", 3, "stateName", PRIVATE,
            "batteryCharge", 17, "batteryCritical", true, "doorsensorState", PRIVATE));
    }

    @ParameterizedTest @ValueSource(strings = {"success", "unmatched", "failure", "empty", "null", "unauthorized"})
    void nukiHttpContractAndSingleDelegationArePreserved(String kind) {
        var service = mock(NukiWebhookService.class);
        var controller = new NukiWebhookController(service);
        when(service.resolveConnectionByToken(PRIVATE)).thenReturn(kind.equals("unauthorized") ? null : connection());
        Map<String, Object> payload = kind.equals("empty") ? Map.of() : kind.equals("null") ? null : nukiPayload();
        boolean delegates = !Set.of("empty", "null", "unauthorized").contains(kind);
        if (kind.equals("failure")) when(service.applyBridgeEvent(payload, ORG)).thenThrow(failure());
        if (kind.equals("success")) when(service.applyBridgeEvent(payload, ORG)).thenReturn(true);
        var response = controller.bridgeCallback(PRIVATE, payload);
        assertThat(response.getStatusCode().value()).isEqualTo(kind.equals("unauthorized") ? 401 : delegates ? 200 : 400);
        assertThat(response.getBody()).isEqualTo(kind.equals("unauthorized") ? Map.of("status", "error", "message", "Invalid webhook secret")
            : delegates ? Map.of("status", "ok", "message", "Event received") : Map.of("status", "error", "message", "Empty payload"));
        verify(service).resolveConnectionByToken(PRIVATE);
        if (delegates) verify(service).applyBridgeEvent(same(payload), eq(ORG));
        verifyNoMoreInteractions(service);
        assertThat(logs.list).isNotEmpty();
    }

    @ParameterizedTest @ValueSource(strings = {"changed", "unchanged", "missing", "unknown", "foreign", "noOrganization"})
    void nukiOwnershipUpdatesRealtimeAndBatteryTriggerKeepTheirExistingContract(String kind) {
        var devices = mock(SmartLockDeviceRepository.class);
        var connections = mock(NukiConnectionRepository.class);
        var realtime = mock(DeviceRealtimePublisher.class);
        var service = new NukiWebhookService(devices, connections, engine, realtime);
        var device = new SmartLockDevice();
        device.setId(RESOURCE); device.setOrganizationId(kind.equals("foreign") ? ORG + 1 : ORG);
        device.setPropertyId(PROPERTY); device.setExternalDeviceId(PRIVATE); device.setName(PRIVATE);
        device.setLockState(kind.equals("unchanged") ? SmartLockDevice.LockState.UNLOCKED : SmartLockDevice.LockState.LOCKED);
        device.setBatteryLevel(kind.equals("unchanged") ? 17 : 90);
        var payload = nukiPayload();
        if (kind.equals("missing")) payload.remove("nukiId");
        else when(devices.findByExternalDeviceId(PRIVATE)).thenReturn(kind.equals("unknown") ? Optional.empty() : Optional.of(device));
        boolean allowed = Set.of("changed", "unchanged").contains(kind);
        assertThat(service.applyBridgeEvent(payload, kind.equals("noOrganization") ? null : ORG)).isEqualTo(allowed);
        if (!kind.equals("missing")) verify(devices).findByExternalDeviceId(PRIVATE);
        if (kind.equals("changed")) {
            verify(devices).save(same(device));
            verify(realtime).publishDeviceChanged(ORG, "lock", RESOURCE, "etat serrure");
            assertThat(device.getLockState()).isEqualTo(SmartLockDevice.LockState.UNLOCKED);
            assertThat(device.getBatteryLevel()).isEqualTo(17);
        } else verifyNoInteractions(realtime);
        if (allowed) {
            var subject = ArgumentCaptor.forClass(AutomationSubject.class);
            verify(engine).fireTrigger(eq(AutomationTrigger.LOCK_BATTERY_CRITICAL), eq(ORG), subject.capture());
            assertThat(subject.getValue().subjectId()).isEqualTo(RESOURCE);
            assertThat(subject.getValue().data()).containsEntry(AutomationSubject.DATA_PROPERTY_ID, PROPERTY)
                .containsEntry(NotifyStaffExecutor.DATA_DEVICE_NAME, PRIVATE)
                .containsEntry(CreateMaintenanceInterventionExecutor.DATA_BATTERY_LEVEL, 17);
        } else verifyNoInteractions(engine);
        verifyNoMoreInteractions(devices, realtime, engine, connections);
        if (kind.equals("unchanged")) assertThat(logs.list).isEmpty();
        else assertThat(logs.list).isNotEmpty();
    }
}
