package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.NotifyStaffExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PayoutReminderScheduler (capteur F9b)")
class PayoutReminderSchedulerTest {

    @Mock private PayoutScheduleConfigRepository scheduleConfigRepository;
    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private AutomationEngine automationEngine;

    @InjectMocks
    private PayoutReminderScheduler scheduler;

    private static OwnerPayout payout(Long id, String amount) {
        OwnerPayout payout = new OwnerPayout();
        payout.setId(id);
        payout.setNetAmount(new BigDecimal(amount));
        payout.setCurrency("EUR");
        return payout;
    }

    @Test
    @DisplayName("sans config -> delai de grace par defaut 7 jours")
    void whenNoConfig_thenDefaultsToSevenDays() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class))).thenReturn(List.of());

        scheduler.firePendingPayoutReminders();

        ArgumentCaptor<Instant> thresholdCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(payoutRepository).findPendingOlderThan(eq(10L), thresholdCaptor.capture());
        Instant expected = Instant.now().minus(PayoutReminderScheduler.DEFAULT_GRACE_DAYS, ChronoUnit.DAYS);
        assertThat(thresholdCaptor.getValue()).isBetween(
                expected.minusSeconds(60), expected.plusSeconds(60));
    }

    @Test
    @DisplayName("config presente -> son gracePeriodDays est utilise")
    void whenConfigPresent_thenUsesConfiguredGraceDays() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setGracePeriodDays(3);
        when(scheduleConfigRepository.findAll()).thenReturn(List.of(config));
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class))).thenReturn(List.of());

        scheduler.firePendingPayoutReminders();

        ArgumentCaptor<Instant> thresholdCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(payoutRepository).findPendingOlderThan(eq(10L), thresholdCaptor.capture());
        Instant expected = Instant.now().minus(3, ChronoUnit.DAYS);
        assertThat(thresholdCaptor.getValue()).isBetween(
                expected.minusSeconds(60), expected.plusSeconds(60));
    }

    @Test
    @DisplayName("aucun payout en retard -> aucun declenchement")
    void whenNoOverduePayouts_thenNothingFired() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class))).thenReturn(List.of());

        scheduler.firePendingPayoutReminders();

        verifyNoInteractions(automationEngine);
    }

    @Test
    @DisplayName("payouts en retard -> un declenchement PAYOUT_PENDING_REMINDER par payout, sujet PAYOUT")
    void whenOverduePayouts_thenFiresPerPayout() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class)))
                .thenReturn(List.of(payout(1L, "120.50"), payout(2L, "80.00")));

        scheduler.firePendingPayoutReminders();

        ArgumentCaptor<AutomationSubject> subjectCaptor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine, org.mockito.Mockito.times(2)).fireTrigger(
                eq(AutomationTrigger.PAYOUT_PENDING_REMINDER), eq(10L), subjectCaptor.capture());

        List<AutomationSubject> subjects = subjectCaptor.getAllValues();
        assertThat(subjects).extracting(AutomationSubject::subjectId).containsExactly(1L, 2L);
        assertThat(subjects.get(0).subjectType()).isEqualTo(NotifyStaffExecutor.SUBJECT_PAYOUT);
        assertThat(subjects.get(0).data())
                .containsEntry(NotifyStaffExecutor.DATA_NET_AMOUNT, "120.50")
                .containsEntry(NotifyStaffExecutor.DATA_CURRENCY, "EUR")
                .containsEntry(NotifyStaffExecutor.DATA_GRACE_DAYS, PayoutReminderScheduler.DEFAULT_GRACE_DAYS);
    }

    @Test
    @DisplayName("pre-filtre : payout deja relance (approvalReminderSentAt pose) -> pas de re-declenchement")
    void whenPayoutAlreadyReminded_thenNotFiredAgain() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(10L));
        OwnerPayout alreadyReminded = payout(1L, "50.00");
        alreadyReminded.setApprovalReminderSentAt(Instant.now().minus(1, ChronoUnit.DAYS));
        OwnerPayout fresh = payout(2L, "75.00");
        when(payoutRepository.findPendingOlderThan(eq(10L), any(Instant.class)))
                .thenReturn(List.of(alreadyReminded, fresh));

        scheduler.firePendingPayoutReminders();

        ArgumentCaptor<AutomationSubject> subjectCaptor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine, org.mockito.Mockito.times(1)).fireTrigger(
                eq(AutomationTrigger.PAYOUT_PENDING_REMINDER), eq(10L), subjectCaptor.capture());
        assertThat(subjectCaptor.getValue().subjectId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("echec d'une org -> les autres orgs sont traitees (isolation)")
    void whenOneOrgFails_thenOthersStillProcessed() {
        when(scheduleConfigRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findOrganizationIdsWithPendingPayouts()).thenReturn(List.of(1L, 2L));
        when(payoutRepository.findPendingOlderThan(eq(1L), any())).thenThrow(new RuntimeException("DB"));
        when(payoutRepository.findPendingOlderThan(eq(2L), any())).thenReturn(List.of(payout(5L, "10.00")));

        assertDoesNotThrow(() -> scheduler.firePendingPayoutReminders());

        verify(automationEngine).fireTrigger(
                eq(AutomationTrigger.PAYOUT_PENDING_REMINDER), eq(2L), any());
        verify(automationEngine, never()).fireTrigger(
                eq(AutomationTrigger.PAYOUT_PENDING_REMINDER), eq(1L), any());
    }
}
