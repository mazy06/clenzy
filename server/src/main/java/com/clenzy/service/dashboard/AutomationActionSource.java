package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.AutomationExecutionRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Automatisations qui ont échoué — l'action promise n'a pas eu lieu.
 *
 * <p>Un message de bienvenue non parti, un code d'accès non transmis : le
 * produit affirme que la règle est active, l'exécution a échoué, et l'échec
 * n'était consigné que dans une colonne que personne ne lit.</p>
 *
 * <p>Technique, donc réservée au staff plateforme : c'est une panne de notre
 * plomberie, pas une décision de gestion. Un hôte n'y pourrait rien.</p>
 */
@Component
public class AutomationActionSource implements ActionItemSource {

    /** Au-delà, l'échec n'est plus rattrapable auprès du voyageur. */
    private static final int LOOKBACK_DAYS = 3;

    private final AutomationExecutionRepository automationExecutionRepository;

    public AutomationActionSource(AutomationExecutionRepository automationExecutionRepository) {
        this.automationExecutionRepository = automationExecutionRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.AUTOMATION_FAILED);
    }

    @Override
    public Scope scope() {
        return Scope.TECHNICAL;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return automationExecutionRepository.findFailedForOrg(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(LOOKBACK_DAYS))
                .stream()
                .map(execution -> new ActionItemDto(
                        "automation:" + execution.getId(),
                        ActionItemKind.AUTOMATION_FAILED,
                        "warning",
                        execution.getAutomationRule() == null
                                ? "Automatisation" : execution.getAutomationRule().getName(),
                        ActionItems.truncate(execution.getErrorMessage(), ActionItems.EXCERPT_LENGTH),
                        null,
                        execution.getId(),
                        null, null, null, null, null, null))
                .toList();
    }
}
