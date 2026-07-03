package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotifyStaffExecutor (action NOTIFY_STAFF)")
class NotifyStaffExecutorTest {

    private static final Long ORG_ID = 1L;

    @Mock private NotificationService notificationService;
    @Mock private OwnerPayoutRepository ownerPayoutRepository;

    private NotifyStaffExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new NotifyStaffExecutor(notificationService, ownerPayoutRepository);
    }

    private static AutomationRule rule(AutomationTrigger trigger) {
        AutomationRule rule = new AutomationRule();
        rule.setId(50L);
        rule.setOrganizationId(ORG_ID);
        rule.setTriggerType(trigger);
        rule.setName("regle test");
        return rule;
    }

    @Test
    @DisplayName("action() -> NOTIFY_STAFF")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.NOTIFY_STAFF);
    }

    @Test
    @DisplayName("PAYOUT_PENDING_REMINDER + CAS gagne -> cle PAYOUT_PENDING_APPROVAL, montant et delai dans le message")
    void payoutReminder_claimWon_notifies() {
        when(ownerPayoutRepository.markApprovalReminderSent(eq(12L), any(Instant.class))).thenReturn(1);
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                NotifyStaffExecutor.SUBJECT_PAYOUT, 12L,
                Map.of(NotifyStaffExecutor.DATA_NET_AMOUNT, "120.50",
                       NotifyStaffExecutor.DATA_CURRENCY, "EUR",
                       NotifyStaffExecutor.DATA_GRACE_DAYS, 7));

        ExecutionResult result = executor.execute(rule(AutomationTrigger.PAYOUT_PENDING_REMINDER), ctx);

        assertThat(result.skipped()).isFalse();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.PAYOUT_PENDING_APPROVAL),
                anyString(),
                contains("#12"),
                eq("/billing?tab=payouts"));
    }

    @Test
    @DisplayName("F9b idempotence : payout deja relance (CAS perdu) -> SKIPPED, aucune notification")
    void payoutReminder_alreadyReminded_skips() {
        when(ownerPayoutRepository.markApprovalReminderSent(eq(12L), any(Instant.class))).thenReturn(0);
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                NotifyStaffExecutor.SUBJECT_PAYOUT, 12L, Map.of());

        ExecutionResult result = executor.execute(rule(AutomationTrigger.PAYOUT_PENDING_REMINDER), ctx);

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja relance");
        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("PAYMENT_FAILED sur intervention -> cle PAYMENT_FAILED, lien vers l'intervention")
    void paymentFailedOnIntervention() {
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                NotifyStaffExecutor.SUBJECT_INTERVENTION, 5L,
                Map.of(NotifyStaffExecutor.DATA_PAYMENT_INTENT_ID, "pi_123"));

        ExecutionResult result = executor.execute(rule(AutomationTrigger.PAYMENT_FAILED), ctx);

        assertThat(result.skipped()).isFalse();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.PAYMENT_FAILED),
                anyString(),
                contains("pi_123"),
                eq("/interventions/5"));
        verifyNoInteractions(ownerPayoutRepository);
    }

    @Test
    @DisplayName("PAYMENT_FAILED sur reservation directe -> lien billing generique")
    void paymentFailedOnDirectBooking() {
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                NotifyStaffExecutor.SUBJECT_DIRECT_BOOKING, 9L,
                Map.of(NotifyStaffExecutor.DATA_PAYMENT_INTENT_ID, "pi_9"));

        executor.execute(rule(AutomationTrigger.PAYMENT_FAILED), ctx);

        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.PAYMENT_FAILED),
                anyString(),
                contains("reservation directe #9"),
                eq("/billing"));
    }

    @Test
    @DisplayName("LOCK_BATTERY_CRITICAL -> cle AUTOMATION_STAFF_ALERT, nom de la serrure dans le message")
    void lockBatteryCritical() {
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, 42L,
                Map.of(NotifyStaffExecutor.DATA_DEVICE_NAME, "Entree principale"));

        ExecutionResult result = executor.execute(rule(AutomationTrigger.LOCK_BATTERY_CRITICAL), ctx);

        assertThat(result.skipped()).isFalse();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.AUTOMATION_STAFF_ALERT),
                anyString(),
                contains("Entree principale"),
                eq("/interventions"));
    }

    @Test
    @DisplayName("F7a dedup memoire : deux declenchements batterie le meme jour -> une seule notification")
    void lockBatteryCritical_dedupedWithin24h() {
        AutomationRule rule = rule(AutomationTrigger.LOCK_BATTERY_CRITICAL);
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID,
                CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, 42L, Map.of());

        ExecutionResult first = executor.execute(rule, ctx);
        ExecutionResult second = executor.execute(rule, ctx);

        assertThat(first.skipped()).isFalse();
        assertThat(second.skipped()).isTrue();
        assertThat(second.detail()).contains("deja notifie");
        verify(notificationService, times(1)).notifyAdminsAndManagersByOrgId(
                any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("autre declencheur (one-shot) -> notification generique AUTOMATION_STAFF_ALERT")
    void genericTrigger() {
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID, "RESERVATION", 3L, Map.of());

        executor.execute(rule(AutomationTrigger.RESERVATION_CANCELLED), ctx);

        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.AUTOMATION_STAFF_ALERT),
                anyString(),
                contains("regle test"),
                isNull());
    }
}
