package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Issue;
import com.clenzy.repository.IssueRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Signalements ouverts que personne n'a qualifiés.
 *
 * <p>Un signalement naît d'une intervention : le technicien constate un dégât,
 * l'enregistre, et l'objet attend une décision — le convertir en prestation ou
 * l'écarter. Rien ne portait cette attente, et un signalement pouvait rester
 * ouvert indéfiniment.</p>
 */
@Component
public class IssueActionSource implements ActionItemSource {

    /** En deçà, la qualification est simplement en cours. */
    private static final int STALE_DAYS = 2;

    private final IssueRepository issueRepository;

    public IssueActionSource(IssueRepository issueRepository) {
        this.issueRepository = issueRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.ISSUE_OPEN);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return issueRepository.findOpenStaleForOrg(
                        ctx.organizationId(),
                        Issue.IssueStatus.OPEN,
                        ctx.nowDateTime().minusDays(STALE_DAYS))
                .stream()
                .map(issue -> new ActionItemDto(
                        "issue:" + issue.getId(),
                        ActionItemKind.ISSUE_OPEN,
                        severityOf(issue),
                        issue.getTitle(),
                        ActionItems.truncate(issue.getDescription(), ActionItems.EXCERPT_LENGTH),
                        null,
                        issue.getId(),
                        issue.getPropertyId(),
                        null,
                        issue.getSuggestedCost(),
                        null, null, null))
                .toList();
    }

    /** La sévérité du signalement fait foi : c'est le terrain qui l'a posée. */
    private static String severityOf(Issue issue) {
        if (issue.getSeverity() == Issue.IssueSeverity.CRITICAL
                || issue.getSeverity() == Issue.IssueSeverity.HIGH) {
            return "critical";
        }
        return issue.getSeverity() == Issue.IssueSeverity.LOW ? "info" : "warning";
    }
}
