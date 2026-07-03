package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AutomationActionRegistryTest {

    private static AutomationActionExecutor executorFor(AutomationAction action) {
        return new AutomationActionExecutor() {
            @Override
            public AutomationAction action() {
                return action;
            }

            @Override
            public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
                return ExecutionResult.executed();
            }
        };
    }

    @Test
    void executorFor_returnsRegisteredExecutor() {
        AutomationActionExecutor sendGuide = executorFor(AutomationAction.SEND_GUIDE);
        AutomationActionExecutor notifyStaff = executorFor(AutomationAction.NOTIFY_STAFF);

        AutomationActionRegistry registry = new AutomationActionRegistry(List.of(sendGuide, notifyStaff));

        assertThat(registry.executorFor(AutomationAction.SEND_GUIDE)).isSameAs(sendGuide);
        assertThat(registry.executorFor(AutomationAction.NOTIFY_STAFF)).isSameAs(notifyStaff);
    }

    @Test
    void executorFor_unknownAction_throwsExplicitly() {
        AutomationActionRegistry registry = new AutomationActionRegistry(
            List.of(executorFor(AutomationAction.SEND_GUIDE)));

        // Pas de no-op silencieux : une action sans executeur echoue explicitement
        // (→ statut FAILED persiste cote moteur).
        assertThatThrownBy(() -> registry.executorFor(AutomationAction.SEND_INVOICE_REMINDER))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SEND_INVOICE_REMINDER");
    }

    @Test
    void duplicateExecutorsForSameAction_failFastAtConstruction() {
        List<AutomationActionExecutor> duplicates = List.of(
            executorFor(AutomationAction.SEND_GUIDE), executorFor(AutomationAction.SEND_GUIDE));

        assertThatThrownBy(() -> new AutomationActionRegistry(duplicates))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SEND_GUIDE");
    }
}
