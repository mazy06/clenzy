package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.InterventionLifecycleService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Reporter une intervention à une nouvelle date.
 *
 * <p>Le statut ne change pas : une intervention en retard qu'on replanifie
 * reste à faire, elle est simplement attendue plus tard.</p>
 */
@Component
public class RescheduleInterventionHandler implements ActionGestureHandler {

    private final InterventionLifecycleService lifecycleService;

    public RescheduleInterventionHandler(InterventionLifecycleService lifecycleService) {
        this.lifecycleService = lifecycleService;
    }

    @Override
    public String action() {
        return "rescheduleIntervention";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_OVERDUE);
    }

    @Override
    public void handle(GestureContext context) {
        lifecycleService.reschedule(context.targetId(), context.scheduledAt(), context.jwt());
    }
}
