package com.clenzy.service.messaging;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutomationSchedulerServiceTest {

    @Mock private AutomationEvaluationService evaluationService;
    @Mock private AutomationRuleRepository ruleRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TenantScopedExecutor tenantScopedExecutor;

    private final Clock clock = Clock.fixed(Instant.now(), ZoneId.systemDefault());
    private final LocalDate today = LocalDate.now(clock);

    private AutomationSchedulerService scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AutomationSchedulerService(evaluationService, ruleRepository,
            reservationRepository, tenantScopedExecutor, clock);
    }

    private void tenantExecutorRunsInline() {
        doAnswer(invocation -> {
            invocation.getArgument(1, Runnable.class).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(anyLong(), any(Runnable.class));
    }

    private static AutomationRule rule(Long orgId, AutomationTrigger trigger, int offsetDays) {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setOrganizationId(orgId);
        rule.setTriggerType(trigger);
        rule.setTriggerOffsetDays(offsetDays);
        return rule;
    }

    @Test
    void tick_drainsPendingExecutions() {
        when(ruleRepository.findByEnabledTrue()).thenReturn(List.of());

        scheduler.processScheduledAutomations();

        verify(evaluationService).processScheduledExecutions();
    }

    @Test
    void tick_drainFailure_doesNotPreventSweep() {
        doThrow(new RuntimeException("DB down")).when(evaluationService).processScheduledExecutions();
        when(ruleRepository.findByEnabledTrue()).thenReturn(List.of());

        scheduler.processScheduledAutomations();

        // Le sweep a bien tourne malgre l'echec du drain (isolation des deux etapes).
        verify(ruleRepository).findByEnabledTrue();
    }

    @Test
    void sweep_checkInApproachingRule_evaluatesUpcomingReservationsWithinOffsetWindow() {
        tenantExecutorRunsInline();
        // F3b : offset J-3 → fenetre de check-in [aujourd'hui - 1, aujourd'hui + 3 + 1].
        when(ruleRepository.findByEnabledTrue())
            .thenReturn(List.of(rule(1L, AutomationTrigger.CHECK_IN_APPROACHING, -3)));

        Reservation upcoming = new Reservation();
        upcoming.setId(100L);
        when(reservationRepository.findConfirmedByCheckInRange(
            today.minusDays(1), today.plusDays(4), 1L)).thenReturn(List.of(upcoming));

        scheduler.processScheduledAutomations();

        verify(evaluationService).evaluateRulesForReservation(
            upcoming, AutomationTrigger.CHECK_IN_APPROACHING, 1L);
        verify(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
    }

    @Test
    void sweep_reviewReminderRule_looksBackFromCheckout() {
        tenantExecutorRunsInline();
        // Relance J+7 → fenetre de check-out [aujourd'hui - 7 - 1, aujourd'hui + 1].
        when(ruleRepository.findByEnabledTrue())
            .thenReturn(List.of(rule(1L, AutomationTrigger.REVIEW_REMINDER, 7)));

        Reservation departed = new Reservation();
        departed.setId(200L);
        when(reservationRepository.findConfirmedByCheckOutRange(
            today.minusDays(8), today.plusDays(1), 1L)).thenReturn(List.of(departed));

        scheduler.processScheduledAutomations();

        verify(evaluationService).evaluateRulesForReservation(
            departed, AutomationTrigger.REVIEW_REMINDER, 1L);
    }

    @Test
    void sweep_eventAndConfirmationTriggers_areNotSwept() {
        // RESERVATION_CONFIRMED (evenementiel, amorce a la creation) et les declencheurs
        // capteurs (NOISE_ALERT...) ne doivent pas etre re-evalues par le sweep.
        when(ruleRepository.findByEnabledTrue()).thenReturn(List.of(
            rule(1L, AutomationTrigger.RESERVATION_CONFIRMED, 0),
            rule(1L, AutomationTrigger.NOISE_ALERT, 0)));

        scheduler.processScheduledAutomations();

        verify(reservationRepository, never()).findConfirmedByCheckInRange(any(), any(), anyLong());
        verify(reservationRepository, never()).findConfirmedByCheckOutRange(any(), any(), anyLong());
        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    @Test
    void sweep_orgFailure_doesNotBlockOtherOrgs() {
        doThrow(new RuntimeException("org 1 KO"))
            .when(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
        doAnswer(invocation -> {
            invocation.getArgument(1, Runnable.class).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(eq(2L), any(Runnable.class));

        AutomationRule org2Rule = rule(2L, AutomationTrigger.CHECK_IN_DAY, 0);
        when(ruleRepository.findByEnabledTrue()).thenReturn(List.of(
            rule(1L, AutomationTrigger.CHECK_IN_DAY, 0), org2Rule));

        Reservation org2Reservation = new Reservation();
        org2Reservation.setId(300L);
        when(reservationRepository.findConfirmedByCheckInRange(
            today.minusDays(1), today.plusDays(1), 2L)).thenReturn(List.of(org2Reservation));

        scheduler.processScheduledAutomations();

        // L'org 2 est traitee malgre l'echec de l'org 1 (isolation par org).
        verify(evaluationService).evaluateRulesForReservation(
            org2Reservation, AutomationTrigger.CHECK_IN_DAY, 2L);
    }

    @Test
    void sweep_windowIsCappedForAberrantOffsets() {
        tenantExecutorRunsInline();
        when(ruleRepository.findByEnabledTrue())
            .thenReturn(List.of(rule(1L, AutomationTrigger.CHECK_IN_APPROACHING, -500)));
        when(reservationRepository.findConfirmedByCheckInRange(
            today.minusDays(1), today.plusDays(AutomationSchedulerService.MAX_SWEEP_WINDOW_DAYS + 1L), 1L))
            .thenReturn(List.of());

        scheduler.processScheduledAutomations();

        verify(reservationRepository).findConfirmedByCheckInRange(
            today.minusDays(1), today.plusDays(AutomationSchedulerService.MAX_SWEEP_WINDOW_DAYS + 1L), 1L);
    }
}
