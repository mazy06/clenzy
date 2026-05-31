package com.clenzy.scheduler;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutReminderSchedulerTest {

    @Mock private PayoutScheduleConfigRepository scheduleConfigRepository;
    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private PayoutReminderScheduler scheduler;

    @Test
    void sendPendingPayoutReminders_noConfig_doesNothing() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());

        scheduler.sendPendingPayoutReminders();

        verifyNoInteractions(payoutRepository, notificationService);
    }

    @Test
    void sendPendingPayoutReminders_noOrgsWithPending_doesNothing() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setGracePeriodDays(3);
        when(scheduleConfigRepository.findAll()).thenReturn(List.of(config));
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of());

        scheduler.sendPendingPayoutReminders();

        verify(payoutRepository).findOrganizationIdsWithPendingPayouts();
        verifyNoInteractions(notificationService);
    }

    @Test
    void sendPendingPayoutReminders_orgWithOverduePayouts_sendsNotification() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setGracePeriodDays(2);
        when(scheduleConfigRepository.findAll()).thenReturn(List.of(config));
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        OwnerPayout payout = mock(OwnerPayout.class);
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class)))
            .thenReturn(List.of(payout, payout));

        scheduler.sendPendingPayoutReminders();

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(10L),
            eq(NotificationKey.PAYOUT_PENDING_APPROVAL),
            anyString(),
            contains("2 reversement"),
            eq("/billing"));
    }

    @Test
    void sendPendingPayoutReminders_emptyForOrg_skipsNotification() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setGracePeriodDays(5);
        when(scheduleConfigRepository.findAll()).thenReturn(List.of(config));
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(20L));
        when(payoutRepository.findPendingOlderThan(eq(20L), any(Instant.class)))
            .thenReturn(List.of());

        scheduler.sendPendingPayoutReminders();

        verifyNoInteractions(notificationService);
    }

    @Test
    void sendPendingPayoutReminders_exceptionForOneOrg_processesOthers() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setGracePeriodDays(2);
        when(scheduleConfigRepository.findAll()).thenReturn(List.of(config));
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(1L, 2L));

        when(payoutRepository.findPendingOlderThan(eq(1L), any())).thenThrow(new RuntimeException("DB"));
        OwnerPayout payout = mock(OwnerPayout.class);
        when(payoutRepository.findPendingOlderThan(eq(2L), any())).thenReturn(List.of(payout));

        assertDoesNotThrow(() -> scheduler.sendPendingPayoutReminders());

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(2L), any(NotificationKey.class), anyString(), anyString(), anyString());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
            eq(1L), any(NotificationKey.class), anyString(), anyString(), anyString());
    }
}
