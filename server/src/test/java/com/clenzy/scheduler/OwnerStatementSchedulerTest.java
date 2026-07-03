package com.clenzy.scheduler;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.SendOwnerStatementExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.ZoneId;
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
@DisplayName("OwnerStatementScheduler (capteur F9a)")
class OwnerStatementSchedulerTest {

    @Mock private AutomationRuleRepository automationRuleRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private AutomationEngine automationEngine;

    @InjectMocks
    private OwnerStatementScheduler scheduler;

    private static AutomationRule rule(Long orgId, AutomationTrigger trigger) {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setTriggerType(trigger);
        rule.setName("test");
        return rule;
    }

    @Test
    @DisplayName("aucune regle active -> aucun declenchement")
    void whenNoEnabledRules_thenNothingFired() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of());

        scheduler.fireMonthlyOwnerStatements();

        verifyNoInteractions(propertyRepository, automationEngine);
    }

    @Test
    @DisplayName("regles actives sur d'autres triggers -> aucun declenchement")
    void whenRulesOnOtherTriggers_thenNothingFired() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(
                rule(1L, AutomationTrigger.RESERVATION_CONFIRMED),
                rule(2L, AutomationTrigger.PAYOUT_PENDING_REMINDER)));

        scheduler.fireMonthlyOwnerStatements();

        verifyNoInteractions(propertyRepository, automationEngine);
    }

    @Test
    @DisplayName("org avec regle -> un declenchement par proprietaire, sujet OWNER + periode du mois ecoule")
    void whenOrgOptedIn_thenFiresPerOwnerWithElapsedMonth() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(
                rule(10L, AutomationTrigger.OWNER_MONTHLY_STATEMENT)));
        when(propertyRepository.findDistinctOwnerIdsByOrgId(10L)).thenReturn(List.of(100L, 200L));

        scheduler.fireMonthlyOwnerStatements();

        ArgumentCaptor<AutomationSubject> subjectCaptor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine, org.mockito.Mockito.times(2)).fireTrigger(
                eq(AutomationTrigger.OWNER_MONTHLY_STATEMENT), eq(10L), subjectCaptor.capture());

        LocalDate expectedFrom = LocalDate.now(ZoneId.of("Europe/Paris")).minusMonths(1).withDayOfMonth(1);
        LocalDate expectedTo = expectedFrom.plusMonths(1).minusDays(1);

        List<AutomationSubject> subjects = subjectCaptor.getAllValues();
        assertThat(subjects).extracting(AutomationSubject::subjectId).containsExactly(100L, 200L);
        for (AutomationSubject subject : subjects) {
            assertThat(subject.subjectType()).isEqualTo(SendOwnerStatementExecutor.SUBJECT_OWNER);
            assertThat(subject.data())
                    .containsEntry(SendOwnerStatementExecutor.DATA_PERIOD_START, expectedFrom.toString())
                    .containsEntry(SendOwnerStatementExecutor.DATA_PERIOD_END, expectedTo.toString());
        }
    }

    @Test
    @DisplayName("plusieurs regles d'une meme org -> l'org n'est declenchee qu'une fois")
    void whenSeveralRulesSameOrg_thenOrgProcessedOnce() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(
                rule(10L, AutomationTrigger.OWNER_MONTHLY_STATEMENT),
                rule(10L, AutomationTrigger.OWNER_MONTHLY_STATEMENT)));
        when(propertyRepository.findDistinctOwnerIdsByOrgId(10L)).thenReturn(List.of(100L));

        scheduler.fireMonthlyOwnerStatements();

        verify(automationEngine, org.mockito.Mockito.times(1))
                .fireTrigger(eq(AutomationTrigger.OWNER_MONTHLY_STATEMENT), eq(10L), any());
    }

    @Test
    @DisplayName("echec d'une org -> les autres orgs sont traitees (isolation)")
    void whenOneOrgFails_thenOthersStillProcessed() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(
                rule(1L, AutomationTrigger.OWNER_MONTHLY_STATEMENT),
                rule(2L, AutomationTrigger.OWNER_MONTHLY_STATEMENT)));
        when(propertyRepository.findDistinctOwnerIdsByOrgId(1L))
                .thenThrow(new RuntimeException("DB"));
        when(propertyRepository.findDistinctOwnerIdsByOrgId(2L)).thenReturn(List.of(300L));

        assertDoesNotThrow(() -> scheduler.fireMonthlyOwnerStatements());

        verify(automationEngine).fireTrigger(
                eq(AutomationTrigger.OWNER_MONTHLY_STATEMENT), eq(2L), any());
        verify(automationEngine, never()).fireTrigger(
                eq(AutomationTrigger.OWNER_MONTHLY_STATEMENT), eq(1L), any());
    }
}
