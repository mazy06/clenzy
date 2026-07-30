package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.InterventionService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Confier une intervention à l'équipe choisie.
 *
 * <p>Le bouton de l'écran reste désactivé tant qu'aucune équipe n'est
 * sélectionnée ; le serveur ne s'en remet pas à l'écran pour autant.</p>
 */
@Component
public class AssignInterventionHandler implements ActionGestureHandler {

    private final InterventionService interventionService;

    public AssignInterventionHandler(InterventionService interventionService) {
        this.interventionService = interventionService;
    }

    @Override
    public String action() {
        return "assign";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_UNASSIGNED);
    }

    @Override
    public void handle(GestureContext context) {
        if (context.assigneeTeamId() == null) {
            throw new IllegalStateException("Aucune equipe choisie pour l'assignation");
        }
        interventionService.assign(
                context.targetId(), null, context.assigneeTeamId(), context.jwt());
    }
}
