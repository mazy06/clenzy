package com.clenzy.service.ai;

import com.clenzy.model.AiUsageLedgerEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Harnais des runs autonomes (campagne X8, ADR-007) : pose le bucket
 * d'autonomie ({@link AutonomyContextHolder}) autour d'un run declenche sans
 * humain, et — pour le premium — applique le gate de plafond
 * ({@link AutonomyBudgetService}) AVANT d'executer.
 *
 * <p>C'est le point d'entree unique des declencheurs autonomes (schedulers,
 * consumers Kafka) : il garantit que le metering taggue le bon bucket et que
 * l'autonomie premium respecte le plafond X4. Le bucket est nettoye en finally
 * — un run autonome ne doit jamais « fuiter » son bucket sur un run interactif
 * ulterieur du meme thread.</p>
 */
@Component
public class AutonomyRunScope {

    private static final Logger log = LoggerFactory.getLogger(AutonomyRunScope.class);

    private final AutonomyContextHolder contextHolder;
    private final AutonomyBudgetService budgetService;

    public AutonomyRunScope(AutonomyContextHolder contextHolder, AutonomyBudgetService budgetService) {
        this.contextHolder = contextHolder;
        this.budgetService = budgetService;
    }

    /**
     * Execute un run d'autonomie SOCLE (auto-reponses, alertes, briefing de
     * base) : debite 0 credit mais trace (D-105). Toujours autorise — le socle
     * fait partie de la promesse incluse.
     */
    public void runSocle(Runnable run) {
        contextHolder.set(AiUsageLedgerEntry.BUCKET_SOCLE);
        try {
            run.run();
        } finally {
            contextHolder.clear();
        }
    }

    /**
     * Execute un run d'autonomie PREMIUM (analyses predictives, rapports lourds,
     * optimisations proactives) SI le gate l'autorise (comportement active +
     * sous plafond de cycle). Sinon, n'execute PAS et retourne la decision
     * (l'appelant applique la consequence : notifier, ou ne rien faire).
     *
     * @return la decision du gate ; {@link AutonomyBudgetService.Decision#allowed()}
     *         indique si le run a ete execute
     */
    public AutonomyBudgetService.Decision runPremium(Long organizationId, String behaviorKey,
                                                     Runnable run) {
        AutonomyBudgetService.Decision decision = budgetService.evaluate(organizationId, behaviorKey);
        if (!decision.allowed()) {
            log.info("[AUTONOMY] Run premium '{}' non execute (org={}, {})",
                    behaviorKey, organizationId, decision.outcome());
            return decision;
        }
        contextHolder.set(AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO);
        try {
            run.run();
        } finally {
            contextHolder.clear();
        }
        return decision;
    }

    /** Variante avec valeur de retour pour le socle. */
    public <T> T runSocle(Supplier<T> run) {
        contextHolder.set(AiUsageLedgerEntry.BUCKET_SOCLE);
        try {
            return run.get();
        } finally {
            contextHolder.clear();
        }
    }
}
