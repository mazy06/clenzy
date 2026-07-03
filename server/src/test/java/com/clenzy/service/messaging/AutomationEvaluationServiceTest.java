package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.automation.AutomationActionContext;
import com.clenzy.service.automation.AutomationActionExecutor;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import com.clenzy.service.automation.AutomationActionRegistry;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutomationEvaluationServiceTest {

    @Mock private AutomationRuleRepository ruleRepository;
    @Mock private AutomationExecutionRepository executionRepository;
    @Mock private AutomationActionRegistry actionRegistry;
    @Mock private AutomationActionExecutor actionExecutor;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private TenantContext tenantContext;

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final Clock clock = Clock.fixed(Instant.now(), ZoneId.systemDefault());

    private AutomationEvaluationService service;

    @BeforeEach
    void setUp() {
        service = new AutomationEvaluationService(ruleRepository, executionRepository,
            new AutomationConditionEvaluator(new com.fasterxml.jackson.databind.ObjectMapper()),
            actionRegistry, reservationRepository, tenantScopedExecutor, tenantContext,
            meterRegistry, clock);
    }

    /** Le moteur enveloppe l'execution hors HTTP dans le contexte tenant de l'org. */
    private void tenantExecutorRunsInline() {
        doAnswer(invocation -> {
            invocation.getArgument(1, Runnable.class).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(anyLong(), any(Runnable.class));
    }

    private void registryReturnsExecutor() {
        when(actionRegistry.executorFor(any())).thenReturn(actionExecutor);
    }

    // ── Chemin temporel ─────────────────────────────────────────────────────────

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
    void evaluateRulesForReservation_alreadyExecutedForSubject_skips() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Test Rule");
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(true);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        service.evaluateRulesForReservation(reservation, AutomationTrigger.RESERVATION_CONFIRMED, 1L);

        // Idempotence : jamais de double execution pour un meme couple (regle x sujet).
        verify(executionRepository, never()).save(any());
        verify(actionRegistry, never()).executorFor(any());
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
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setCheckIn(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_IN_APPROACHING, 1L);

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        AutomationExecution saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(AutomationExecutionStatus.PENDING);
        assertThat(saved.getSubjectType()).isEqualTo(AutomationSubject.TYPE_RESERVATION);
        assertThat(saved.getSubjectId()).isEqualTo(100L);
        assertThat(saved.getScheduledAt().toLocalDate())
            .isEqualTo(reservation.getCheckIn().minusDays(1));
    }

    @Test
    void checkInApproaching_scheduleComputedInPropertyTimezone() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Livret J-1");
        rule.setTriggerType(AutomationTrigger.CHECK_IN_APPROACHING);
        rule.setTriggerOffsetDays(-1);
        rule.setTriggerTime("09:00");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.CHECK_IN_APPROACHING))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);

        Property property = new Property();
        property.setId(42L);
        property.setTimezone("Pacific/Auckland");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_IN_APPROACHING, 1L);

        // 09:00 dans le fuseau DU LOGEMENT, converti en heure murale serveur (convention
        // de stockage de scheduled_at) — regle d'audit #9.
        LocalDateTime expected = reservation.getCheckIn().minusDays(1).atTime(9, 0)
            .atZone(ZoneId.of("Pacific/Auckland"))
            .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduledAt()).isEqualTo(expected);
    }

    @Test
    void checkInApproaching_positiveOffsetMeansDaysBeforeCheckIn() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Livret J-3");
        rule.setTriggerType(AutomationTrigger.CHECK_IN_APPROACHING);
        rule.setTriggerOffsetDays(3); // distance, pas decalage signe : 3 == J-3
        rule.setTriggerTime("09:00");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.CHECK_IN_APPROACHING))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setCheckIn(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_IN_APPROACHING, 1L);

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduledAt().toLocalDate())
            .isEqualTo(reservation.getCheckIn().minusDays(3));
    }

    @Test
    void reservationConfirmed_executesImmediatelyAndIncrementsMetric() {
        registryReturnsExecutor();
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Bienvenue");
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        rule.setActionType(AutomationAction.SEND_MESSAGE);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);
        when(actionExecutor.execute(eq(rule), any())).thenReturn(ExecutionResult.executed());

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        service.evaluateRulesForReservation(reservation, AutomationTrigger.RESERVATION_CONFIRMED, 1L);

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        assertThat(meterRegistry.counter("automation.flow.executed", "action", "SEND_MESSAGE").count())
            .isEqualTo(1.0);
    }

    @Test
    void evaluateRulesForReservation_conditionsNotMatched_skips() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Sejours longs uniquement");
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        rule.setConditions("{\"minNights\": 5}");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            10L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setCheckIn(LocalDate.now());
        reservation.setCheckOut(LocalDate.now().plusDays(2)); // 2 nuits < 5

        service.evaluateRulesForReservation(reservation, AutomationTrigger.RESERVATION_CONFIRMED, 1L);

        verify(executionRepository, never()).save(any());
    }

    @Test
    void onReservationCreated_evaluatesOnlyReservationLifecycleTriggers() {
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(eq(1L), any()))
            .thenReturn(List.of());

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        service.onReservationCreated(reservation, 1L);

        for (AutomationTrigger trigger : AutomationTrigger.RESERVATION_LIFECYCLE) {
            verify(ruleRepository).findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, trigger);
        }
        // Les declencheurs evenementiels (bruit, facture...) ne sont PAS amorces ici.
        verify(ruleRepository, never()).findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.NOISE_ALERT);
        verify(ruleRepository, never()).findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.INVOICE_OVERDUE);
    }

    // ── Drain (executions planifiees) ───────────────────────────────────────────

    @Test
    void processScheduledExecutions_executesReadyUnderTenantContext() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Auto message");
        rule.setActionType(AutomationAction.SEND_MESSAGE);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        AutomationExecution exec = pendingExecution(rule, reservation);
        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        when(actionExecutor.execute(eq(rule), any())).thenReturn(ExecutionResult.executed());

        service.processScheduledExecutions();

        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        assertThat(exec.getExecutedAt()).isNotNull();
        verify(executionRepository).save(exec);
        // Z2-EFFETS : hors HTTP, l'action tourne sous le contexte tenant de SON org.
        verify(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
    }

    @Test
    void processScheduledExecutions_failedAction_setsFailedStatus() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setName("Failing rule");
        rule.setActionType(AutomationAction.SEND_MESSAGE);

        Reservation reservation = new Reservation();
        reservation.setId(100L);

        AutomationExecution exec = pendingExecution(rule, reservation);
        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        when(actionExecutor.execute(eq(rule), any()))
            .thenThrow(new RuntimeException("Email service down"));

        service.processScheduledExecutions();

        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.FAILED);
        assertThat(exec.getErrorMessage()).contains("Email service down");
    }

    @Test
    void processScheduledExecutions_rescheduledByExecutor_staysPendingAtNewDeadline() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(13L);
        rule.setName("Revocation code");
        rule.setTriggerType(AutomationTrigger.CHECK_OUT_DAY);
        rule.setActionType(AutomationAction.REVOKE_ACCESS_CODE);

        Reservation reservation = new Reservation();
        reservation.setId(103L);

        AutomationExecution exec = pendingExecution(rule, reservation);
        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        LocalDateTime newDeadline = LocalDateTime.now().plusHours(3);
        when(actionExecutor.execute(eq(rule), any()))
            .thenReturn(ExecutionResult.rescheduled(newDeadline, "Check-out + grace non atteint"));

        service.processScheduledExecutions();

        // Statut NON-terminal : l'execution one-shot n'est PAS consommee, elle repart
        // en PENDING a la nouvelle echeance (guard temporel F4b).
        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.PENDING);
        assertThat(exec.getScheduledAt()).isEqualTo(newDeadline);
        assertThat(exec.getErrorMessage()).contains("grace");
        assertThat(exec.getExecutedAt()).isNull();
        verify(executionRepository).save(exec);
        // Pas de metrique executed pour une re-planification.
        assertThat(meterRegistry.counter("automation.flow.executed", "action", "REVOKE_ACCESS_CODE").count())
            .isEqualTo(0.0);
    }

    @Test
    void revokeAccessCodeRule_scheduledAtCheckOutMomentPlusGrace() {
        // F4b : planification a l'heure EXACTE du depart + grace (pas au triggerTime).
        AutomationRule rule = new AutomationRule();
        rule.setId(14L);
        rule.setName("Revocation code J depart");
        rule.setTriggerType(AutomationTrigger.CHECK_OUT_DAY);
        rule.setActionType(AutomationAction.REVOKE_ACCESS_CODE);
        rule.setTriggerTime("09:00"); // ignore pour cette action
        rule.setActionConfig("{\"graceHours\": 6}");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.CHECK_OUT_DAY))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            14L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);

        Property property = new Property();
        property.setId(42L);
        property.setTimezone("Pacific/Auckland");
        property.setDefaultCheckOutTime("11:00");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_OUT_DAY, 1L);

        // 11:00 (heure de check-out du logement, fuseau logement) + 6 h de grace,
        // convertie en heure murale serveur (convention scheduled_at).
        LocalDateTime expected = reservation.getCheckOut().atTime(11, 0)
            .atZone(ZoneId.of("Pacific/Auckland")).plusHours(6)
            .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AutomationExecutionStatus.PENDING);
        assertThat(captor.getValue().getScheduledAt()).isEqualTo(expected);
    }

    @Test
    void processScheduledExecutions_skippedByExecutor_setsSkippedStatusWithReason() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(12L);
        rule.setName("Relance avis J+7");
        rule.setTriggerType(AutomationTrigger.REVIEW_REMINDER);
        rule.setActionType(AutomationAction.SEND_REVIEW_REQUEST);

        Reservation reservation = new Reservation();
        reservation.setId(102L);

        AutomationExecution exec = pendingExecution(rule, reservation);
        when(executionRepository.findByStatusAndScheduledAtBefore(
            eq(AutomationExecutionStatus.PENDING), any()))
            .thenReturn(List.of(exec));
        when(actionExecutor.execute(eq(rule), any()))
            .thenReturn(ExecutionResult.skipped("Avis deja recu"));

        service.processScheduledExecutions();

        assertThat(exec.getStatus()).isEqualTo(AutomationExecutionStatus.SKIPPED);
        assertThat(exec.getErrorMessage()).contains("Avis deja recu");
        verify(executionRepository).save(exec);
    }

    // ── Chemin evenementiel (fireTrigger) ───────────────────────────────────────

    @Test
    void fireTrigger_matchingRule_executesImmediately() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(20L);
        rule.setName("Relance facture");
        rule.setTriggerType(AutomationTrigger.INVOICE_OVERDUE);
        rule.setActionType(AutomationAction.SEND_INVOICE_REMINDER);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.INVOICE_OVERDUE))
            .thenReturn(List.of(rule));
        // INVOICE_OVERDUE est RECURRENT (dedupePerSubject=false) : pas de check exists moteur.
        when(actionExecutor.execute(eq(rule), any())).thenReturn(ExecutionResult.executed());

        service.fireTrigger(AutomationTrigger.INVOICE_OVERDUE, 1L,
            new AutomationSubject(AutomationSubject.TYPE_INVOICE, 55L, Map.of("daysOverdue", 3)));

        ArgumentCaptor<AutomationExecution> execCaptor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(execCaptor.capture());
        AutomationExecution saved = execCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        assertThat(saved.getSubjectType()).isEqualTo(AutomationSubject.TYPE_INVOICE);
        assertThat(saved.getSubjectId()).isEqualTo(55L);
        assertThat(saved.getReservation()).isNull();

        ArgumentCaptor<AutomationActionContext> ctxCaptor = ArgumentCaptor.forClass(AutomationActionContext.class);
        verify(actionExecutor).execute(eq(rule), ctxCaptor.capture());
        assertThat(ctxCaptor.getValue().dataAsLong("daysOverdue")).isEqualTo(3L);
        assertThat(meterRegistry.counter("automation.flow.executed", "action", "SEND_INVOICE_REMINDER").count())
            .isEqualTo(1.0);
    }

    @Test
    void fireTrigger_sameSubjectTwice_isIdempotent() {
        // La dedup moteur ne s'applique qu'aux triggers ONE-SHOT (dedupePerSubject=true,
        // ex. NOISE_ALERT) — les recurrents (INVOICE_OVERDUE...) portent leur cle metier.
        tenantExecutorRunsInline();

        AutomationRule rule = new AutomationRule();
        rule.setId(20L);
        rule.setName("Avertissement bruit");
        rule.setTriggerType(AutomationTrigger.NOISE_ALERT);
        rule.setActionType(AutomationAction.SEND_NOISE_WARNING);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.NOISE_ALERT))
            .thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            20L, AutomationSubject.TYPE_NOISE_ALERT, 55L)).thenReturn(true);

        service.fireTrigger(AutomationTrigger.NOISE_ALERT, 1L,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, 55L, Map.of()));

        verify(actionRegistry, never()).executorFor(any());
        verify(executionRepository, never()).save(any());
    }

    @Test
    void fireTrigger_reservationSubject_resolvesReservationIntoContext() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule rule = new AutomationRule();
        rule.setId(21L);
        rule.setName("Menage post-checkout");
        rule.setTriggerType(AutomationTrigger.RESERVATION_BOOKED);
        rule.setActionType(AutomationAction.CREATE_CLEANING_REQUEST);

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setOrganizationId(1L);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_BOOKED))
            .thenReturn(List.of(rule));
        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            21L, AutomationSubject.TYPE_RESERVATION, 100L)).thenReturn(false);
        when(actionExecutor.execute(eq(rule), any())).thenReturn(ExecutionResult.executed());

        service.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, 1L,
            new AutomationSubject(AutomationSubject.TYPE_RESERVATION, 100L, Map.of()));

        ArgumentCaptor<AutomationActionContext> ctxCaptor = ArgumentCaptor.forClass(AutomationActionContext.class);
        verify(actionExecutor).execute(eq(rule), ctxCaptor.capture());
        assertThat(ctxCaptor.getValue().reservation()).isSameAs(reservation);
    }

    @Test
    void fireTrigger_reservationMissing_executesNothing() {
        tenantExecutorRunsInline();

        AutomationRule rule = new AutomationRule();
        rule.setId(21L);
        rule.setTriggerType(AutomationTrigger.RESERVATION_BOOKED);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_BOOKED))
            .thenReturn(List.of(rule));
        when(reservationRepository.findById(100L)).thenReturn(Optional.empty());

        service.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, 1L,
            new AutomationSubject(AutomationSubject.TYPE_RESERVATION, 100L, Map.of()));

        verify(executionRepository, never()).save(any());
        verify(actionRegistry, never()).executorFor(any());
    }

    @Test
    void fireTrigger_crossOrgReservation_isRejected() {
        tenantExecutorRunsInline();

        AutomationRule rule = new AutomationRule();
        rule.setId(21L);
        rule.setTriggerType(AutomationTrigger.RESERVATION_BOOKED);

        Reservation crossOrg = new Reservation();
        crossOrg.setId(100L);
        crossOrg.setOrganizationId(2L); // autre org que celle du declenchement

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_BOOKED))
            .thenReturn(List.of(rule));
        when(reservationRepository.findById(100L)).thenReturn(Optional.of(crossOrg));

        assertThatThrownBy(() -> service.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, 1L,
                new AutomationSubject(AutomationSubject.TYPE_RESERVATION, 100L, Map.of())))
            .isInstanceOf(AccessDeniedException.class);
        verify(executionRepository, never()).save(any());
    }

    @Test
    void fireTrigger_conditionsEvaluatedOnSubjectData() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        AutomationRule matching = new AutomationRule();
        matching.setId(30L);
        matching.setName("Propriete 42 uniquement");
        matching.setTriggerType(AutomationTrigger.NOISE_ALERT);
        matching.setActionType(AutomationAction.SEND_NOISE_WARNING);
        matching.setConditions("{\"propertyIds\": [42]}");

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.NOISE_ALERT))
            .thenReturn(List.of(matching));
        when(executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
            eq(30L), eq(AutomationSubject.TYPE_NOISE_ALERT), anyLong())).thenReturn(false);
        when(actionExecutor.execute(eq(matching), any())).thenReturn(ExecutionResult.executed());

        // Alerte sur la propriete 42 → la regle matche.
        service.fireTrigger(AutomationTrigger.NOISE_ALERT, 1L,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, 7L,
                Map.of(AutomationSubject.DATA_PROPERTY_ID, 42L)));
        verify(actionExecutor, times(1)).execute(eq(matching), any());

        // Alerte sur une autre propriete → conditions non satisfaites, rien n'est execute.
        service.fireTrigger(AutomationTrigger.NOISE_ALERT, 1L,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, 8L,
                Map.of(AutomationSubject.DATA_PROPERTY_ID, 99L)));
        verify(actionExecutor, times(1)).execute(eq(matching), any());
    }

    @Test
    void fireTrigger_recurringTrigger_isNotDedupedBySubject() {
        tenantExecutorRunsInline();
        registryReturnsExecutor();

        // Releve mensuel : sujet stable (owner) declenche chaque mois — l'idempotence
        // moteur est deleguee a la cle metier de l'executeur (owner_statement_dispatch).
        AutomationRule rule = new AutomationRule();
        rule.setId(40L);
        rule.setName("Releve mensuel");
        rule.setTriggerType(AutomationTrigger.OWNER_MONTHLY_STATEMENT);
        rule.setActionType(AutomationAction.SEND_OWNER_STATEMENT);

        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.OWNER_MONTHLY_STATEMENT))
            .thenReturn(List.of(rule));
        when(actionExecutor.execute(eq(rule), any())).thenReturn(ExecutionResult.executed());

        AutomationSubject owner = new AutomationSubject("OWNER", 7L, Map.of());
        service.fireTrigger(AutomationTrigger.OWNER_MONTHLY_STATEMENT, 1L, owner);
        service.fireTrigger(AutomationTrigger.OWNER_MONTHLY_STATEMENT, 1L, owner);

        verify(actionExecutor, times(2)).execute(eq(rule), any());
        verify(executionRepository, never())
            .existsByAutomationRuleIdAndSubjectTypeAndSubjectId(anyLong(), anyString(), anyLong());
    }

    @Test
    void fireTrigger_noEnabledRules_doesNotTouchTenantScope() {
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.NOISE_ALERT))
            .thenReturn(List.of());

        service.fireTrigger(AutomationTrigger.NOISE_ALERT, 1L,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, 7L, Map.of()));

        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    private AutomationExecution pendingExecution(AutomationRule rule, Reservation reservation) {
        AutomationExecution exec = new AutomationExecution();
        exec.setId(1L);
        exec.setOrganizationId(1L);
        exec.setAutomationRule(rule);
        exec.setSubjectType(AutomationSubject.TYPE_RESERVATION);
        exec.setSubjectId(reservation.getId());
        exec.setReservation(reservation);
        exec.setStatus(AutomationExecutionStatus.PENDING);
        exec.setScheduledAt(LocalDateTime.now().minusHours(1));
        return exec;
    }
}
