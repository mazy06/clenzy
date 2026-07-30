package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.IssueService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Convertir un signalement en prestation.
 *
 * <p>Le service protège lui-même de la double conversion par une transition
 * conditionnelle : ce geste n'a pas à la redémontrer.</p>
 */
@Component
public class ConvertIssueHandler implements ActionGestureHandler {

    private final IssueService issueService;

    public ConvertIssueHandler(IssueService issueService) {
        this.issueService = issueService;
    }

    @Override
    public String action() {
        return "convert";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.ISSUE_OPEN);
    }

    @Override
    public void handle(GestureContext context) {
        issueService.convert(context.targetId(), context.actorId());
    }
}
