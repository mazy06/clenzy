package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.NoiseAlertService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Acquitter une alerte de bruit.
 *
 * <p>Aucun effet de bord : ni envoi, ni paiement. Le geste dit simplement
 * qu'une personne a vu l'alerte et s'en occupe.</p>
 */
@Component
public class AcknowledgeNoiseAlertHandler implements ActionGestureHandler {

    private final NoiseAlertService noiseAlertService;

    public AcknowledgeNoiseAlertHandler(NoiseAlertService noiseAlertService) {
        this.noiseAlertService = noiseAlertService;
    }

    @Override
    public String action() {
        return "acknowledge";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED);
    }

    @Override
    public void handle(GestureContext context) {
        noiseAlertService.acknowledge(
                context.targetId(), context.orgId(), context.actorId(), null);
    }
}
