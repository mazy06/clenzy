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
    @Mock private com.clenzy.service.agent.supervision.SupervisionActivityService supervisionActivityService;
    @Mock private com.clenzy.repository.GuestMessageLogRepository guestMessageLogRepository;

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final Clock clock = Clock.fixed(Instant.now(), ZoneId.systemDefault());

    @Mock private com.clenzy.service.automation.BaitlyAutomationContext recoveryContext;
    @Mock private com.clenzy.service.automation.BaitlyAutomationJournal journal;
    private AutomationEvaluationService service;

    @BeforeEach
    void setUp() {
        service = new AutomationEvaluationService(ruleRepository, executionRepository,
            new AutomationConditionEvaluator(new com.fasterxml.jackson.databind.ObjectMapper()),
            actionRegistry, reservationRepository, tenantScopedExecutor, tenantContext,
            meterRegistry, supervisionActivityService, clock, guestMessageLogRepository,
            recoveryContext, journal, mock(org.springframework.transaction.PlatformTransactionManager.class));
        lenient().when(ruleRepository.lockForAdmission(anyLong(),anyLong())).thenAnswer(call -> {
            Long ruleId=call.getArgument(0);Long org=call.getArgument(1);
            for(var trigger:AutomationTrigger.values()) {
                for(var rule:ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(org,trigger)) {
                    if(ruleId.equals(rule.getId())) {rule.setOrganizationId(org);return Optional.of(rule);}
                }
            }
            return Optional.empty();
        });
        lenient().when(recoveryContext.freeze(any(),any())).thenAnswer(c->c.getArgument(1));
        lenient().when(recoveryContext.key(any(),any(),any(),any())).thenReturn("synthetic-key");
        lenient().when(recoveryContext.encode(any(),any(),any(),any())).thenReturn("GCMv1:synthetic");
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
    void importedReservationDoesNotReplayAutomations() {
        Reservation imported = new Reservation();
        imported.setMigrationAutomationPaused(true);
        service.onReservationCreated(imported, 1L);
        verifyNoInteractions(ruleRepository, executionRepository, actionRegistry);
    }

    @Test
    void evaluateRulesForReservation_noRules_doesNothing() {
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.RESERVATION_CONFIRMED))
            .thenReturn(List.of());

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setOrganizationId(1L);

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
        reservation.setOrganizationId(1L);

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
        reservation.setOrganizationId(1L);
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
        reservation.setOrganizationId(1L);
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
        reservation.setOrganizationId(1L);
        reservation.setCheckIn(LocalDate.now().plusDays(10));

        service.evaluateRulesForReservation(reservation, AutomationTrigger.CHECK_IN_APPROACHING, 1L);

        ArgumentCaptor<AutomationExecution> captor = ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduledAt().toLocalDate())
            .isEqualTo(reservation.getCheckIn().minusDays(3));
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
        reservation.setOrganizationId(1L);
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
        reservation.setOrganizationId(1L);

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
        reservation.setOrganizationId(1L);
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



    // ── Chemin evenementiel (fireTrigger) ───────────────────────────────────────



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
    void fireTrigger_noEnabledRules_doesNotTouchTenantScope() {
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L, AutomationTrigger.NOISE_ALERT))
            .thenReturn(List.of());

        service.fireTrigger(AutomationTrigger.NOISE_ALERT, 1L,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, 7L, Map.of()));

        verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
    }

    @Test void confirmedReservationQueuesBeforeAnyExecutorAndEncryptsContext() {
        var rule=new AutomationRule();rule.setId(10L);rule.setOrganizationId(1L);
        rule.setTriggerType(AutomationTrigger.RESERVATION_CONFIRMED);
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L,rule.getTriggerType())).thenReturn(List.of(rule));
        var stay=new Reservation();stay.setId(100L);stay.setOrganizationId(1L);
        service.evaluateRulesForReservation(stay,rule.getTriggerType(),1L);
        var captor=ArgumentCaptor.forClass(AutomationExecution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getDurableState()).isEqualTo("PENDING");
        assertThat(captor.getValue().getDurableContext()).isEqualTo("GCMv1:synthetic");
        verifyNoInteractions(actionRegistry);
    }
    @Test void anUncertainPriorOccurrenceBlocksRecurringAdmission() {
        tenantExecutorRunsInline();
        var rule=new AutomationRule();rule.setId(10L);rule.setOrganizationId(1L);
        rule.setTriggerType(AutomationTrigger.INVOICE_OVERDUE);
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L,rule.getTriggerType())).thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndDurableStateIn(
            eq(10L),eq(1L),eq("INVOICE"),eq(7L),anyList())).thenReturn(true);
        service.fireTrigger(rule.getTriggerType(),1L,new AutomationSubject("INVOICE",7L,Map.of()));
        verify(executionRepository,never()).save(any());verifyNoInteractions(actionRegistry);
    }
    @Test void replayRequiresEvidenceAndCannotRearmAnUnknownOrHistoricalFailure() {
        var execution=new AutomationExecution();execution.setOrganizationId(1L);execution.setStatus(AutomationExecutionStatus.FAILED);
        when(executionRepository.findById(7L)).thenReturn(Optional.of(execution));
        assertThatThrownBy(()->service.replayExecution(7L,1L)).hasMessage("AUTOMATION_RECONCILIATION_REQUIRED");
        assertThatThrownBy(()->service.replayExecution(7L,2L)).hasMessage("Execution introuvable");
        verifyNoInteractions(actionRegistry);verify(executionRepository,never()).save(any());
    }
    @Test void historicalFailureCannotBeReintroducedAsANewRecurringOccurrence() {
        tenantExecutorRunsInline();
        var rule=new AutomationRule();rule.setId(10L);rule.setOrganizationId(1L);rule.setTriggerType(AutomationTrigger.INVOICE_OVERDUE);
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L,rule.getTriggerType())).thenReturn(List.of(rule));
        when(executionRepository.existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndStatusAndDurableStateIsNull(
            10L,1L,"INVOICE",7L,AutomationExecutionStatus.FAILED)).thenReturn(true);
        service.fireTrigger(rule.getTriggerType(),1L,new AutomationSubject("INVOICE",7L,Map.of()));
        verify(executionRepository,never()).save(any());verifyNoInteractions(actionRegistry);
    }

    @Test void competingTriggerAdmissionsTakeRuleLocksInAStableOrder() {
        tenantExecutorRunsInline();
        var first=new AutomationRule();first.setId(10L);first.setOrganizationId(1L);first.setTriggerType(AutomationTrigger.NOISE_ALERT);
        var second=new AutomationRule();second.setId(20L);second.setOrganizationId(1L);second.setTriggerType(AutomationTrigger.NOISE_ALERT);
        when(ruleRepository.findByOrganizationIdAndTriggerTypeAndEnabledTrue(1L,AutomationTrigger.NOISE_ALERT)).thenReturn(List.of(second,first));
        service.fireTrigger(AutomationTrigger.NOISE_ALERT,1L,new AutomationSubject("NOISE_ALERT",7L,Map.of()));
        var ordered=inOrder(ruleRepository);ordered.verify(ruleRepository).lockForAdmission(10L,1L);
        ordered.verify(ruleRepository).lockForAdmission(20L,1L);
        verifyNoInteractions(actionRegistry);
    }

}
