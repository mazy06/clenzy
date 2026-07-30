package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.InterventionLifecycleService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Attester qu'une intervention en retard a bien eu lieu.
 *
 * <p>Le geste <b>déclenche le paiement du prestataire</b> — gardé par la preuve
 * photo. La carte l'annonce : ce n'est pas un simple changement de statut.</p>
 *
 * <p>Seul {@code IN_PROGRESS} peut passer à {@code COMPLETED} : une intervention
 * en retard restée {@code PENDING} — le cas le plus courant — serait refusée. Or
 * le sens réel du geste est « le travail a eu lieu », donc elle a bien commencé
 * avant de finir. On franchit les deux marches plutôt que de renvoyer une
 * transition invalide à quelqu'un qui constate un fait.</p>
 */
@Component
public class CompleteInterventionHandler implements ActionGestureHandler {

    private final InterventionRepository interventionRepository;
    private final InterventionLifecycleService lifecycleService;

    public CompleteInterventionHandler(InterventionRepository interventionRepository,
                                       InterventionLifecycleService lifecycleService) {
        this.interventionRepository = interventionRepository;
        this.lifecycleService = lifecycleService;
    }

    @Override
    public String action() {
        return "complete";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_OVERDUE);
    }

    @Override
    public void handle(GestureContext context) {
        final Intervention intervention = interventionRepository.findById(context.targetId())
                .orElseThrow(() -> new IllegalArgumentException("Intervention introuvable"));
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            lifecycleService.startIntervention(context.targetId(), context.jwt());
        }
        lifecycleService.completeIntervention(context.targetId(), context.jwt());
    }
}
