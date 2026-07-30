package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.messaging.AutomationEvaluationService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Rejouer une automatisation en échec, et elle seule.
 *
 * <p>Le point d'entrée habituel réévalue toutes les règles du déclencheur : il
 * renverrait les messages de celles qui avaient abouti.</p>
 */
@Component
public class ReplayAutomationHandler implements ActionGestureHandler {

    private final AutomationEvaluationService automationEvaluationService;

    public ReplayAutomationHandler(AutomationEvaluationService automationEvaluationService) {
        this.automationEvaluationService = automationEvaluationService;
    }

    @Override
    public String action() {
        return "replayAutomation";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.AUTOMATION_FAILED);
    }

    @Override
    public void handle(GestureContext context) {
        automationEvaluationService.replayExecution(context.targetId(), context.orgId());
    }
}
