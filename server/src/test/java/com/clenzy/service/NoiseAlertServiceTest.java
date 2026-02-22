package com.clenzy.service;

import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseAlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertServiceTest {

    @Mock private NoiseAlertConfigRepository configRepository;
    @Mock private NoiseAlertRepository alertRepository;
    @Mock private NoiseAlertNotificationService notificationService;

    @InjectMocks
    private NoiseAlertService service;

    private NoiseAlertConfig config;
    private NoiseAlertTimeWindow dayWindow;
    private NoiseAlertTimeWindow nightWindow;

    @BeforeEach
    void setUp() {
        config = new NoiseAlertConfig();
        config.setId(1L);
        config.setOrganizationId(10L);
        config.setPropertyId(100L);
        config.setEnabled(true);
        config.setCooldownMinutes(30);

        dayWindow = new NoiseAlertTimeWindow();
        dayWindow.setLabel("Jour");
        dayWindow.setStartTime(LocalTime.of(7, 0));
        dayWindow.setEndTime(LocalTime.of(22, 0));
        dayWindow.setWarningThresholdDb(70);
        dayWindow.setCriticalThresholdDb(85);
        dayWindow.setConfig(config);

        nightWindow = new NoiseAlertTimeWindow();
        nightWindow.setLabel("Nuit");
        nightWindow.setStartTime(LocalTime.of(22, 0));
        nightWindow.setEndTime(LocalTime.of(7, 0));
        nightWindow.setWarningThresholdDb(55);
        nightWindow.setCriticalThresholdDb(70);
        nightWindow.setConfig(config);

        config.getTimeWindows().addAll(List.of(dayWindow, nightWindow));
    }

    // ─── evaluateNoiseLevel ────────────────────────────────────────────────────

    @Test
    void whenConfigAbsent_thenReturnsNull() {
        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.empty());

        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 80.0, AlertSource.WEBHOOK);

        assertNull(result);
        verifyNoInteractions(alertRepository, notificationService);
    }

    @Test
    void whenConfigDisabled_thenReturnsNull() {
        config.setEnabled(false);
        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.of(config));

        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 80.0, AlertSource.WEBHOOK);

        assertNull(result);
        verifyNoInteractions(alertRepository, notificationService);
    }

    @Test
    void whenBelowThreshold_thenReturnsNull() {
        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.of(config));

        // 40 dB is below ALL windows (night warning=55, day warning=70)
        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 40.0, AlertSource.SCHEDULER);

        assertNull(result);
        verify(alertRepository, never()).save(any());
    }

    @Test
    void whenWarningThresholdExceeded_thenCreatesWarningAlert() {
        // Use only day window so we control which thresholds apply
        config.getTimeWindows().clear();
        NoiseAlertTimeWindow allDay = new NoiseAlertTimeWindow();
        allDay.setLabel("24h");
        allDay.setStartTime(LocalTime.of(0, 0));
        allDay.setEndTime(LocalTime.of(0, 0)); // 00:00-00:00 = full day
        allDay.setWarningThresholdDb(70);
        allDay.setCriticalThresholdDb(85);
        allDay.setConfig(config);
        config.getTimeWindows().add(allDay);

        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.of(config));
        when(alertRepository.existsRecentAlert(anyLong(), any(AlertSeverity.class), any()))
            .thenReturn(false);
        when(alertRepository.save(any(NoiseAlert.class)))
            .thenAnswer(inv -> {
                NoiseAlert a = inv.getArgument(0);
                a.setId(42L);
                return a;
            });

        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 75.0, AlertSource.WEBHOOK);

        assertNotNull(result);
        assertEquals(AlertSeverity.WARNING, result.getSeverity());
        assertEquals(75.0, result.getMeasuredDb());
        assertEquals(70, result.getThresholdDb());
        verify(notificationService).dispatch(any(), eq(config));
    }

    @Test
    void whenCriticalThresholdExceeded_thenCreatesCriticalAlert() {
        // Use only day window
        config.getTimeWindows().clear();
        NoiseAlertTimeWindow allDay = new NoiseAlertTimeWindow();
        allDay.setLabel("24h");
        allDay.setStartTime(LocalTime.of(0, 0));
        allDay.setEndTime(LocalTime.of(0, 0));
        allDay.setWarningThresholdDb(70);
        allDay.setCriticalThresholdDb(85);
        allDay.setConfig(config);
        config.getTimeWindows().add(allDay);

        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.of(config));
        when(alertRepository.existsRecentAlert(anyLong(), any(AlertSeverity.class), any()))
            .thenReturn(false);
        when(alertRepository.save(any(NoiseAlert.class)))
            .thenAnswer(inv -> {
                NoiseAlert a = inv.getArgument(0);
                a.setId(43L);
                return a;
            });

        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 90.0, AlertSource.WEBHOOK);

        assertNotNull(result);
        assertEquals(AlertSeverity.CRITICAL, result.getSeverity());
        assertEquals(85, result.getThresholdDb());
    }

    @Test
    void whenCooldownActive_thenReturnsNull() {
        when(configRepository.findByOrgAndPropertyWithTimeWindows(10L, 100L))
            .thenReturn(Optional.of(config));
        when(alertRepository.existsRecentAlert(anyLong(), any(AlertSeverity.class), any()))
            .thenReturn(true);

        NoiseAlert result = service.evaluateNoiseLevel(10L, 100L, 1L, 75.0, AlertSource.WEBHOOK);

        assertNull(result);
        verify(alertRepository, never()).save(any());
    }

    // ─── findMatchingWindow ────────────────────────────────────────────────────

    @Test
    void whenTimeInDayWindow_thenReturnsDayWindow() {
        NoiseAlertTimeWindow match = service.findMatchingWindow(
            List.of(dayWindow, nightWindow), LocalTime.of(12, 0));

        assertNotNull(match);
        assertEquals("Jour", match.getLabel());
    }

    @Test
    void whenTimeInNightWindow_thenReturnsNightWindow() {
        // 23:00 should match overnight window (22:00-07:00)
        NoiseAlertTimeWindow match = service.findMatchingWindow(
            List.of(dayWindow, nightWindow), LocalTime.of(23, 0));

        assertNotNull(match);
        assertEquals("Nuit", match.getLabel());
    }

    @Test
    void whenTimeInEarlyMorning_thenReturnsNightWindow() {
        // 03:00 should also match overnight window (22:00-07:00)
        NoiseAlertTimeWindow match = service.findMatchingWindow(
            List.of(dayWindow, nightWindow), LocalTime.of(3, 0));

        assertNotNull(match);
        assertEquals("Nuit", match.getLabel());
    }

    // ─── determineSeverity ─────────────────────────────────────────────────────

    @Test
    void whenBelowWarning_thenSeverityIsNull() {
        assertNull(service.determineSeverity(50.0, dayWindow));
    }

    @Test
    void whenBetweenWarningAndCritical_thenSeverityIsWarning() {
        assertEquals(AlertSeverity.WARNING, service.determineSeverity(75.0, dayWindow));
    }

    @Test
    void whenAboveCritical_thenSeverityIsCritical() {
        assertEquals(AlertSeverity.CRITICAL, service.determineSeverity(90.0, dayWindow));
    }
}
