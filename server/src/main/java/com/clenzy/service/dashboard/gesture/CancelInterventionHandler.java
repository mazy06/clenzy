package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.InterventionLifecycleService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Annuler une intervention qui n'aura pas lieu.
 *
 * <p>Passe par le cycle de vie, qui réserve l'annulation au staff plateforme.
 * Écrire le statut ici court-circuiterait cette règle — elle ne vaudrait plus
 * que pour les appelants qui veulent bien la respecter.</p>
 */
@Component
public class CancelInterventionHandler implements ActionGestureHandler {

    private final InterventionLifecycleService lifecycleService;

    public CancelInterventionHandler(InterventionLifecycleService lifecycleService) {
        this.lifecycleService = lifecycleService;
    }

    @Override
    public String action() {
        return "cancelIntervention";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_OVERDUE);
    }

    @Override
    public void handle(GestureContext context) {
        lifecycleService.updateStatus(context.targetId(), "CANCELLED", context.jwt());
    }
}
