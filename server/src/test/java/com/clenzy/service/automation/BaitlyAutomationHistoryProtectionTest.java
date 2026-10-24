package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.repository.*;
import com.clenzy.service.AutomationRuleService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyAutomationHistoryProtectionTest {
    final AutomationRuleRepository rules=mock(AutomationRuleRepository.class);
    final TenantContext tenant=mock(TenantContext.class);
    final AutomationRuleService service=new AutomationRuleService(rules,mock(AutomationExecutionRepository.class),mock(MessageTemplateRepository.class),tenant);
    void owned() {
        when(tenant.getOrganizationId()).thenReturn(7L);
        var rule=new AutomationRule();rule.setId(1L);rule.setOrganizationId(7L);
        when(rules.findByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(rule));
    }
    @Test void deletingProtectedHistoryReturnsConflictWithoutSqlOrPrivateCause() {
        owned();doThrow(new org.springframework.dao.DataIntegrityViolationException("private@example.invalid SQL token")).when(rules).flush();
        var error=catchThrowableOfType(()->service.delete(1L),org.springframework.web.server.ResponseStatusException.class);
        assertThat(error.getStatusCode().value()).isEqualTo(409);
        assertThat(error.getReason()).isEqualTo("AUTOMATION_HISTORY_PROTECTED");
        assertThat(error.getCause()).isNull();assertThat(error.toString()).doesNotContain("private@example.invalid","SQL token");
    }
    @Test void foreignRuleIsNeverDeleted() {
        when(tenant.getOrganizationId()).thenReturn(8L);
        assertThatThrownBy(()->service.delete(1L)).isInstanceOf(IllegalArgumentException.class);
        verify(rules,never()).delete(any());verify(rules,never()).flush();
    }
    @Test void ruleWithoutProtectedHistoryKeepsNormalDeletion() {
        owned();service.delete(1L);verify(rules).delete(any(AutomationRule.class));verify(rules).flush();
    }
}
