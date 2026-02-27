package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutomationEvaluationServiceTest {

    @Mock private AutomationRuleRepository ruleRepository;
    @Mock private AutomationExecutionRepository executionRepository;
    @Mock private GuestMessagingService messagingService;

    private AutomationEvaluationService service;

    @BeforeEach
    void setUp() {
        service = new AutomationEvaluationService(ruleRepository, executionRepository, messagingService);
    }

    @Test
    void evaluateRulesForReservation_noRules_doesNothing() {
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of());

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        service.evaluateRulesForReservation(reservation, AutomationTrigger.RESERVATION_CONFIRMED, 1L);

        verify(executionRepository, never()).save(any());
    }

    @Test
    void evaluateRulesForReservation_alreadyExecuted_skips() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Test Rule");
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        rule.setTriggerOffsetDays(0);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndReservationId(10L, 100L)).thenReturn(true);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        service.evaluateRulesForReservation(reservation, AutomationTrigger.RESERVATION_CONFIRMED, 1L);

        verify(executionRepository, never()).save(any());
    }

    @Test
    void evaluateRulesForReservation_futureSchedule_createsPending() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Pre check-in");
        rule.setTriggerType(AutomationTrigger.CHECK_IN_APPROACHING);
        rule.setTriggerOffsetDays(-1);
        rule.setTriggerTime("09:00");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.CHECK_IN_APPROACHING))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndReservationId(10L, 100L)).thenReturn(false);

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setCheckIn(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_IN_APPROACHING, 1L);

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AutomationExecutionStatus.PENDING);
    }

    @Test
    void processScheduledExecutions_executesReady() {
        MessageTemplate template = new MessageTemplate();
        template.setId(5L);
        template.setName("Check-in template");

        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Auto message");
        rule.setActionType(AutomationAction.SEND_MESSAGE);
        rule.setTemplate(template);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        AutomationExecution exec = new AutomationExecution();
        exec.setId(1L);
        exec.setOrganizationId(1L);
        exec.setAutomationRule(rule);
        exec.setReservation(reservation);
        exec.setStatus(AutomationExecutionStatus.PENDING);
        exec.setScheduledAt(LocalDateTime.now().minusHours(1));

        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        when(messagingService.sendForReservation(reservation, template, 1L)).thenReturn(null);

        service.processScheduledExecutions();

        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        verify(executionRepository).save(exec);
    }

    @Test
    void processScheduledExecutions_failedAction_setsFailedStatus() {
        MessageTemplate template = new MessageTemplate();
        template.setId(5L);

        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Failing rule");
        rule.setActionType(AutomationAction.SEND_MESSAGE);
        rule.setTemplate(template);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        AutomationExecution exec = new AutomationExecution();
        exec.setId(1L);
        exec.setOrganizationId(1L);
        exec.setAutomationRule(rule);
        exec.setReservation(reservation);
        exec.setStatus(AutomationExecutionStatus.PENDING);
        exec.setScheduledAt(LocalDateTime.now().minusHours(1));

        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        when(messagingService.sendForReservation(reservation, template, 1L))
            .thenThrow(new RuntimeException("Email service down"));

        service.processScheduledExecutions();

        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.FAILED);
        assertThat(exec.getErrorMessage()).contains("Email service down");
    }
}
