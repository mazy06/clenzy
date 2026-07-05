package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotifyRateParityExecutor (action NOTIFY_RATE_PARITY, S2)")
class RateParityNotifyExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;

    @Mock private NotificationService notificationService;

    private NotifyRateParityExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new NotifyRateParityExecutor(notificationService);
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setId(70L);
        rule.setOrganizationId(ORG_ID);
        rule.setTriggerType(AutomationTrigger.RATE_PARITY_DISPARITY);
        rule.setName("parite tarifaire");
        return rule;
    }

    private static AutomationActionContext contextWithData() {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_PROPERTY, PROPERTY_ID,
                Map.of(NotifyRateParityExecutor.DATA_PROPERTY_NAME, "Villa Yasmine",
                       NotifyRateParityExecutor.DATA_DISPARITY_DAYS, 4,
                       NotifyRateParityExecutor.DATA_MAX_DEVIATION_PERCENT, "12.50",
                       NotifyRateParityExecutor.DATA_CHANNELS, "airbnb,booking_com"));
    }

    @Test
    @DisplayName("action() -> NOTIFY_RATE_PARITY")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.NOTIFY_RATE_PARITY);
    }

    @Test
    @DisplayName("donnees du rapport presentes -> notification staff avec nom, canaux, jours et ecart")
    void whenSubjectHasReportData_thenNotifiesWithDetails() {
        ExecutionResult result = executor.execute(rule(), contextWithData());

        assertThat(result.skipped()).isFalse();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                contains("Disparite"),
                contains("Villa Yasmine"),
                eq("/channels"));
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                contains("Disparite"), contains("12.50"), eq("/channels"));
    }

    @Test
    @DisplayName("donnees volatiles absentes (chemin draine) -> message generique depuis le sujet seul")
    void whenDataEmpty_thenGenericMessageStillExecutes() {
        AutomationActionContext ctx = new AutomationActionContext(
                ORG_ID, AutomationSubject.TYPE_PROPERTY, PROPERTY_ID, Map.of());

        ExecutionResult result = executor.execute(rule(), ctx);

        assertThat(result.skipped()).isFalse();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID),
                eq(NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                contains("Disparite"),
                contains("#" + PROPERTY_ID),
                eq("/channels"));
    }

    @Test
    @DisplayName("meme regle + meme bien + meme jour -> 2e execution SKIPPED (cle bien+jour), 1 seule notification")
    void whenSameSubjectSameDay_thenSecondExecutionSkipped() {
        ExecutionResult first = executor.execute(rule(), contextWithData());
        ExecutionResult second = executor.execute(rule(), contextWithData());

        assertThat(first.skipped()).isFalse();
        assertThat(second.skipped()).isTrue();
        assertThat(second.detail()).contains("deja notifiee");
        verify(notificationService, times(1)).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                contains("Disparite"), contains("Villa Yasmine"), eq("/channels"));
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("autre bien le meme jour -> notification independante (dedup par sujet)")
    void whenDifferentSubject_thenNotIndependentlyDeduped() {
        executor.execute(rule(), contextWithData());
        AutomationActionContext other = new AutomationActionContext(
                ORG_ID, AutomationSubject.TYPE_PROPERTY, 43L, Map.of());

        ExecutionResult result = executor.execute(rule(), other);

        assertThat(result.skipped()).isFalse();
        verify(notificationService, times(2)).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                contains("Disparite"), contains("prix"), eq("/channels"));
    }
}
