package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Registre action → executeur, construit par injection de tous les beans
 * {@link AutomationActionExecutor} (OCP : un nouveau flux = un nouveau bean,
 * zero modification du moteur).
 */
@Component
public class AutomationActionRegistry {

    private final Map<AutomationAction, AutomationActionExecutor> executors;

    public AutomationActionRegistry(List<AutomationActionExecutor> discoveredExecutors) {
        Map<AutomationAction, AutomationActionExecutor> byAction = new EnumMap<>(AutomationAction.class);
        for (AutomationActionExecutor executor : discoveredExecutors) {
            AutomationActionExecutor previous = byAction.putIfAbsent(executor.action(), executor);
            if (previous != null) {
                // Fail-fast au boot : deux executeurs pour la meme action = bug de cablage.
                throw new IllegalStateException("Deux executeurs enregistres pour l'action "
                    + executor.action() + " : " + previous.getClass().getSimpleName()
                    + " et " + executor.getClass().getSimpleName());
            }
        }
        this.executors = Collections.unmodifiableMap(byAction);
    }

    /**
     * @throws IllegalStateException si aucun executeur n'est enregistre pour l'action
     *                               (→ statut FAILED explicite cote moteur, pas de no-op)
     */
    public AutomationActionExecutor executorFor(AutomationAction action) {
        AutomationActionExecutor executor = executors.get(action);
        if (executor == null) {
            throw new IllegalStateException("Aucun executeur enregistre pour l'action " + action
                + " — fournir un bean AutomationActionExecutor dans le module proprietaire du flux");
        }
        return executor;
    }
}
