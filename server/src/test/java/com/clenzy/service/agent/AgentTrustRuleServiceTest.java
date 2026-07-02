package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.model.AgentTrustRule;
import com.clenzy.repository.AgentPendingActionRepository;
import com.clenzy.repository.AgentTrustRuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regles de Confiance (X2) : suggestion seulement quand les N DERNIERES
 * resolutions sont toutes CONFIRMED, jamais pour les outils argent, jamais en
 * double ; le gate n'auto-approuve que les regles ACTIVE ; transitions avec
 * ownership org et decideur trace.
 */
@ExtendWith(MockitoExtension.class)
class AgentTrustRuleServiceTest {

    private static final int THRESHOLD = 5;

    @Mock private AgentTrustRuleRepository ruleRepository;
    @Mock private AgentPendingActionRepository pendingActionRepository;

    private AgentTrustRuleService service() {
        return new AgentTrustRuleService(ruleRepository, pendingActionRepository, THRESHOLD, true);
    }

    private static AgentPendingAction resolved(String toolName, String status) {
        AgentPendingAction action = new AgentPendingAction(
                "tc-" + Math.abs(toolName.hashCode() + status.hashCode()),
                42L, "kc-1", 7L, toolName, "{}", null, null, false, "[]",
                Instant.now().plusSeconds(600));
        action.resolve(status);
        return action;
    }

    // ─── Evaluation des suggestions ──────────────────────────────────────────

    @Test
    void allRecentConfirmed_createsSuggestedRule() {
        when(pendingActionRepository.findTrustRuleCandidates(THRESHOLD))
                .thenReturn(List.<Object[]>of(new Object[]{42L, "block_calendar_day"}));
        when(ruleRepository.existsByOrganizationIdAndToolName(42L, "block_calendar_day"))
                .thenReturn(false);
        when(pendingActionRepository
                .findByOrganizationIdAndToolNameAndStatusNotOrderByResolvedAtDesc(
                        eq(42L), eq("block_calendar_day"), eq(AgentPendingAction.STATUS_PENDING), any()))
                .thenReturn(List.of(
                        resolved("block_calendar_day", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("block_calendar_day", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("block_calendar_day", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("block_calendar_day", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("block_calendar_day", AgentPendingAction.STATUS_CONFIRMED)));

        int created = service().evaluateSuggestions();

        assertThat(created).isEqualTo(1);
        ArgumentCaptor<AgentTrustRule> captor = ArgumentCaptor.forClass(AgentTrustRule.class);
        verify(ruleRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AgentTrustRule.STATUS_SUGGESTED);
        assertThat(captor.getValue().getToolName()).isEqualTo("block_calendar_day");
    }

    @Test
    void recentRefusalInWindow_blocksSuggestion() {
        when(pendingActionRepository.findTrustRuleCandidates(THRESHOLD))
                .thenReturn(List.<Object[]>of(new Object[]{42L, "send_guest_message"}));
        when(ruleRepository.existsByOrganizationIdAndToolName(42L, "send_guest_message"))
                .thenReturn(false);
        // 4 confirmations + 1 REFUS recent : le pattern est invalide.
        when(pendingActionRepository
                .findByOrganizationIdAndToolNameAndStatusNotOrderByResolvedAtDesc(
                        eq(42L), eq("send_guest_message"), eq(AgentPendingAction.STATUS_PENDING), any()))
                .thenReturn(List.of(
                        resolved("send_guest_message", AgentPendingAction.STATUS_REFUSED),
                        resolved("send_guest_message", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("send_guest_message", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("send_guest_message", AgentPendingAction.STATUS_CONFIRMED),
                        resolved("send_guest_message", AgentPendingAction.STATUS_CONFIRMED)));

        assertThat(service().evaluateSuggestions()).isZero();
        verify(ruleRepository, never()).save(any());
    }

    @Test
    void moneyTools_areNeverSuggested() {
        when(pendingActionRepository.findTrustRuleCandidates(THRESHOLD))
                .thenReturn(List.<Object[]>of(new Object[]{42L, "initiate_refund"}));

        assertThat(service().evaluateSuggestions()).isZero();
        verify(ruleRepository, never()).save(any());
    }

    @Test
    void existingRule_isNeverReSuggested() {
        when(pendingActionRepository.findTrustRuleCandidates(THRESHOLD))
                .thenReturn(List.<Object[]>of(new Object[]{42L, "block_calendar_day"}));
        when(ruleRepository.existsByOrganizationIdAndToolName(42L, "block_calendar_day"))
                .thenReturn(true); // deja SUGGESTED/ACTIVE/DISMISSED/REVOKED : on respecte

        assertThat(service().evaluateSuggestions()).isZero();
        verify(ruleRepository, never()).save(any());
    }

    // ─── Gate d'auto-approbation ─────────────────────────────────────────────

    @Test
    void gate_onlyActiveRulesAutoApprove() {
        when(ruleRepository.existsByOrganizationIdAndToolNameAndStatus(
                42L, "block_calendar_day", AgentTrustRule.STATUS_ACTIVE)).thenReturn(true);
        when(ruleRepository.existsByOrganizationIdAndToolNameAndStatus(
                42L, "send_guest_message", AgentTrustRule.STATUS_ACTIVE)).thenReturn(false);

        assertThat(service().isAutoApproved(42L, "block_calendar_day")).isTrue();
        assertThat(service().isAutoApproved(42L, "send_guest_message")).isFalse();
    }

    @Test
    void gate_moneyTools_neverAutoApproved_evenWithActiveRule() {
        assertThat(service().isAutoApproved(42L, "initiate_refund")).isFalse();
        assertThat(service().isAutoApproved(42L, "settle_intervention_payment")).isFalse();
        verify(ruleRepository, never()).existsByOrganizationIdAndToolNameAndStatus(
                anyLong(), anyString(), anyString());
    }

    @Test
    void gate_databaseFailure_failsSafe_toConfirmation() {
        when(ruleRepository.existsByOrganizationIdAndToolNameAndStatus(anyLong(), anyString(), anyString()))
                .thenThrow(new RuntimeException("db down"));

        assertThat(service().isAutoApproved(42L, "block_calendar_day")).isFalse();
    }

    // ─── Transitions ─────────────────────────────────────────────────────────

    @Test
    void accept_activatesRule_withDecider() {
        AgentTrustRule rule = new AgentTrustRule(42L, "block_calendar_day", 5);
        when(ruleRepository.findByIdAndOrganizationId(1L, 42L)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(rule)).thenReturn(rule);

        AgentTrustRule accepted = service().accept(1L, 42L, "kc-admin");

        assertThat(accepted.getStatus()).isEqualTo(AgentTrustRule.STATUS_ACTIVE);
        assertThat(accepted.getDecidedBy()).isEqualTo("kc-admin");
        assertThat(accepted.getDecidedAt()).isNotNull();
    }

    @Test
    void transitions_refuseCrossOrgRule() {
        when(ruleRepository.findByIdAndOrganizationId(1L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().accept(1L, 42L, "kc-admin"))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service().revoke(1L, 42L, "kc-admin"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void revoke_returnsToolToConfirmation() {
        AgentTrustRule rule = new AgentTrustRule(42L, "block_calendar_day", 5);
        rule.decide(AgentTrustRule.STATUS_ACTIVE, "kc-admin");
        when(ruleRepository.findByIdAndOrganizationId(1L, 42L)).thenReturn(Optional.of(rule));
        when(ruleRepository.save(rule)).thenReturn(rule);

        assertThat(service().revoke(1L, 42L, "kc-admin").getStatus())
                .isEqualTo(AgentTrustRule.STATUS_REVOKED);
    }
}
