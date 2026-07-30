package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.service.IssueService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Écarter un signalement sans suite.
 *
 * <p>Sans effet de bord : le signalement cesse simplement d'attendre une
 * décision.</p>
 */
@Component
public class DismissIssueHandler implements ActionGestureHandler {

    private final IssueService issueService;

    public DismissIssueHandler(IssueService issueService) {
        this.issueService = issueService;
    }

    @Override
    public String action() {
        return "dismiss";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.ISSUE_OPEN);
    }

    @Override
    public void handle(GestureContext context) {
        issueService.dismiss(context.targetId(), new DismissIssueRequest(null));
    }
}
