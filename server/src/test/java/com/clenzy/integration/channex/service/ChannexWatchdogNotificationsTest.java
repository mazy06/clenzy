package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.ChannexHealthSummary;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.AttentionItem;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.Severity;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests cibles pour {@link ChannexWatchdogScheduler#emitNotifications} —
 * validation des transitions ERROR -> RECOVERED + dedup — Phase 5 audit T6.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexWatchdogScheduler notifications transitions (T6)")
class ChannexWatchdogNotificationsTest {

    @Mock private ChannexConnectService connectService;
    @Mock private NotificationService notificationService;
    @Mock private ChannexProperties channexProperties;

    private ChannexWatchdogScheduler scheduler;

    @BeforeEach
    void setUp() {
        when(channexProperties.isConfigured()).thenReturn(true);
        scheduler = new ChannexWatchdogScheduler(connectService, notificationService,
            channexProperties, new SimpleMeterRegistry());
    }

    private AttentionItem errorItem(Long propertyId, String name) {
        return new AttentionItem(
            propertyId, 42L, name, ChannexSyncStatus.ERROR, Severity.ERROR,
            "Mapping en erreur", Instant.now().minusSeconds(3600), "API 503");
    }

    private ChannexHealthSummary summaryWithErrors(List<AttentionItem> items) {
        Map<ChannexSyncStatus, Integer> counts = new java.util.EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus s : ChannexSyncStatus.values()) counts.put(s, 0);
        counts.put(ChannexSyncStatus.ERROR, items.size());
        return new ChannexHealthSummary(items.size(), counts, items, Instant.now());
    }

    @Test
    @DisplayName("Transition IN : property entre nouvellement en ERROR -> notifie ERROR")
    void transitionIn_emitsErrorNotification() {
        when(connectService.computeHealthSummary(null))
            .thenReturn(summaryWithErrors(List.of(errorItem(100L, "Studio Marais"))));

        scheduler.scan();

        verify(notificationService).notifyAdminsAndManagers(
            eq(NotificationKey.CHANNEX_SYNC_ERROR),
            any(),
            contains("Studio Marais"),
            contains("diagnoseChannex=100"),
            eq(42L)
        );
    }

    @Test
    @DisplayName("Transition stable : property toujours en ERROR au 2eme scan -> pas de notif (dedup)")
    void transitionStable_noDuplicateNotification() {
        when(connectService.computeHealthSummary(null))
            .thenReturn(summaryWithErrors(List.of(errorItem(100L, "Studio"))));

        scheduler.scan(); // scan 1 : notifie
        scheduler.scan(); // scan 2 : property toujours en ERROR → pas de re-notif

        // Une seule notif ERROR au total
        verify(notificationService).notifyAdminsAndManagers(
            eq(NotificationKey.CHANNEX_SYNC_ERROR), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("Transition OUT : property notifiee en ERROR puis n'est plus en ERROR -> notifie RECOVERED")
    void transitionOut_emitsRecoveredNotification() {
        // Scan 1 : property en ERROR
        when(connectService.computeHealthSummary(null))
            .thenReturn(summaryWithErrors(List.of(errorItem(100L, "Studio"))));
        scheduler.scan();

        // Scan 2 : property n'est plus en ERROR (sortie de la liste attention)
        Map<ChannexSyncStatus, Integer> counts = new java.util.EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus s : ChannexSyncStatus.values()) counts.put(s, 0);
        counts.put(ChannexSyncStatus.ACTIVE, 1);
        when(connectService.computeHealthSummary(null))
            .thenReturn(new ChannexHealthSummary(1, counts, List.of(), Instant.now()));
        scheduler.scan();

        verify(notificationService).notifyAdminsAndManagers(
            eq(NotificationKey.CHANNEX_SYNC_RECOVERED),
            any(),
            contains("100"),
            any(),
            eq(42L)
        );
    }

    @Test
    @DisplayName("Aucune attention item ERROR -> pas de notification emise")
    void noAttention_noNotification() {
        Map<ChannexSyncStatus, Integer> counts = new java.util.EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus s : ChannexSyncStatus.values()) counts.put(s, 0);
        when(connectService.computeHealthSummary(null))
            .thenReturn(new ChannexHealthSummary(0, counts, List.of(), Instant.now()));

        scheduler.scan();

        verify(notificationService, never()).notifyAdminsAndManagers(
            any(), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("WARNING + INFO seulement -> pas de notification (uniquement ERROR transitions notifiees)")
    void warningInfoOnly_noNotification() {
        AttentionItem warning = new AttentionItem(
            100L, 42L, "Studio", ChannexSyncStatus.PENDING, Severity.WARNING,
            "PENDING > 24h", null, null);
        AttentionItem info = new AttentionItem(
            200L, 42L, "House", ChannexSyncStatus.ACTIVE, Severity.INFO,
            "Stale", null, null);
        Map<ChannexSyncStatus, Integer> counts = new java.util.EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus s : ChannexSyncStatus.values()) counts.put(s, 0);
        counts.put(ChannexSyncStatus.PENDING, 1);
        counts.put(ChannexSyncStatus.ACTIVE, 1);
        when(connectService.computeHealthSummary(null))
            .thenReturn(new ChannexHealthSummary(2, counts, List.of(warning, info), Instant.now()));

        scheduler.scan();

        verify(notificationService, never()).notifyAdminsAndManagers(
            any(), any(), any(), any(), anyLong());
    }
}
