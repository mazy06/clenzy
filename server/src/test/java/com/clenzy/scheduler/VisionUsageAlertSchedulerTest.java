package com.clenzy.scheduler;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OrgVisionAlert;
import com.clenzy.repository.OrgVisionAlertRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.vision.VisionTokenUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class VisionUsageAlertSchedulerTest {

    private static final Instant T0 = Instant.parse("2026-05-26T05:00:00Z");

    private OrgVisionAlertRepository alertRepository;
    private VisionTokenUsageService usageService;
    private NotificationService notificationService;
    private Clock clock;

    @BeforeEach
    void setUp() {
        alertRepository = mock(OrgVisionAlertRepository.class);
        usageService = mock(VisionTokenUsageService.class);
        notificationService = mock(NotificationService.class);
        clock = Clock.fixed(T0, ZoneId.of("UTC"));
    }

    private VisionUsageAlertScheduler scheduler(boolean enabled) {
        return new VisionUsageAlertScheduler(alertRepository, usageService,
                notificationService, clock, enabled);
    }

    @Test
    void runOnce_disabled_skipsLookup() {
        assertEquals(0, scheduler(false).runOnce());
        verifyNoInteractions(alertRepository);
    }

    @Test
    void runOnce_noConfigs_returnsZero() {
        when(alertRepository.findAll()).thenReturn(List.of());
        assertEquals(0, scheduler(true).runOnce());
        verifyNoInteractions(usageService);
        verifyNoInteractions(notificationService);
    }

    @Test
    void runOnce_listFails_returnsZero_doesNotThrow() {
        when(alertRepository.findAll()).thenThrow(new RuntimeException("DB"));
        assertEquals(0, scheduler(true).runOnce());
    }

    @Test
    void runOnce_underThreshold_doesNotAlert() {
        OrgVisionAlert cfg = newConfig(1L, 1_000_000L, null);
        when(alertRepository.findAll()).thenReturn(List.of(cfg));
        when(usageService.getMonthlyUsage(1L)).thenReturn(500_000L);

        assertEquals(0, scheduler(true).runOnce());
        verifyNoInteractions(notificationService);
        verify(alertRepository, never()).save(any());
    }

    @Test
    void runOnce_overThreshold_alertsAdmins_andStampsTime() {
        OrgVisionAlert cfg = newConfig(1L, 1_000_000L, null);
        when(alertRepository.findAll()).thenReturn(List.of(cfg));
        when(usageService.getMonthlyUsage(1L)).thenReturn(1_500_000L);
        // CAS acquis (autres instances HA en attente = 0)
        when(alertRepository.casLastAlertedAt(eq(1L), eq((LocalDateTime) null), any()))
                .thenReturn(1);

        int sent = scheduler(true).runOnce();

        assertEquals(1, sent);
        verify(notificationService).notifyAdminsAndManagers(
                eq(NotificationKey.VISION_USAGE_THRESHOLD_REACHED),
                anyString(), anyString(),
                eq("/settings?tab=ai"),
                eq(1L));
        // Refresh in-memory pour la coherence du caller
        assertNotNull(cfg.getLastAlertedAt());
    }

    @Test
    void runOnce_casLost_skipsAlert() {
        // Scenario HA : autre instance a deja stampe last_alerted_at depuis qu'on a lu
        OrgVisionAlert cfg = newConfig(1L, 1_000_000L, null);
        when(alertRepository.findAll()).thenReturn(List.of(cfg));
        when(usageService.getMonthlyUsage(1L)).thenReturn(5_000_000L);
        when(alertRepository.casLastAlertedAt(eq(1L), eq((LocalDateTime) null), any()))
                .thenReturn(0);

        int sent = scheduler(true).runOnce();

        assertEquals(0, sent);
        verifyNoInteractions(notificationService);
    }

    @Test
    void runOnce_recentlyAlerted_throttled() {
        // Derniere alerte il y a 2 jours → < 7j → skip
        LocalDateTime twoDaysAgo = LocalDateTime.ofInstant(T0, ZoneId.of("UTC")).minusDays(2);
        OrgVisionAlert cfg = newConfig(1L, 1_000_000L, twoDaysAgo);
        when(alertRepository.findAll()).thenReturn(List.of(cfg));
        when(usageService.getMonthlyUsage(1L)).thenReturn(5_000_000L);

        assertEquals(0, scheduler(true).runOnce());
        verifyNoInteractions(notificationService);
        verify(alertRepository, never()).save(any());
    }

    @Test
    void runOnce_oldAlert_canRe_alert() {
        // Derniere alerte il y a 10 jours → > 7j → on peut re-alerter
        LocalDateTime tenDaysAgo = LocalDateTime.ofInstant(T0, ZoneId.of("UTC")).minusDays(10);
        OrgVisionAlert cfg = newConfig(1L, 1_000_000L, tenDaysAgo);
        when(alertRepository.findAll()).thenReturn(List.of(cfg));
        when(usageService.getMonthlyUsage(1L)).thenReturn(5_000_000L);
        // CAS sur la valeur "tenDaysAgo" → on est la 1ere a la remplacer
        when(alertRepository.casLastAlertedAt(eq(1L), eq(tenDaysAgo), any())).thenReturn(1);

        assertEquals(1, scheduler(true).runOnce());
        verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any(), eq(1L));
    }

    @Test
    void runOnce_oneOrgFails_continuesOthers() {
        OrgVisionAlert cfg1 = newConfig(1L, 1_000_000L, null);
        OrgVisionAlert cfg2 = newConfig(2L, 1_000_000L, null);
        when(alertRepository.findAll()).thenReturn(List.of(cfg1, cfg2));
        when(usageService.getMonthlyUsage(1L)).thenThrow(new RuntimeException("kaboom"));
        when(usageService.getMonthlyUsage(2L)).thenReturn(5_000_000L);
        when(alertRepository.casLastAlertedAt(eq(2L), eq((LocalDateTime) null), any()))
                .thenReturn(1);

        int sent = scheduler(true).runOnce();
        // Org 1 throw mais boucle continue → org 2 alertee
        assertEquals(1, sent);
    }

    private static OrgVisionAlert newConfig(Long orgId, long threshold, LocalDateTime lastAlertedAt) {
        OrgVisionAlert cfg = new OrgVisionAlert(orgId, threshold);
        cfg.setId(orgId);
        cfg.setLastAlertedAt(lastAlertedAt);
        return cfg;
    }
}
