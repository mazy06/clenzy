package com.clenzy.service.automation;

import com.clenzy.model.AutomationTrigger;

/**
 * Point d'entree evenementiel du moteur AutomationRule (fiche 08, vague 2).
 *
 * <p>Contrat SPI : les sources d'evenements (consumer {@code calendar.updates},
 * schedulers, services capteurs) appellent {@link #fireTrigger} ; le moteur
 * evalue les regles actives de l'organisation pour ce declencheur (conditions
 * JSON sur {@link AutomationSubject#data()}), applique l'idempotence generique
 * {@code AutomationExecution} (regle x subjectType x subjectId) et execute les
 * actions via le registre des {@link AutomationActionExecutor}.</p>
 *
 * <p>L'implementation appartient au moteur central (agent moteur) — les sources
 * d'evenements ne dependent que de cette interface.</p>
 */
public interface AutomationEngine {

    /**
     * Metrique incrementee par le moteur a chaque action EXECUTEE, taguee {@code action}.
     * Les executeurs n'ont PAS a l'incrementer eux-memes (le moteur le fait apres un
     * resultat executed) — seuls les chemins hors moteur (ex. filets quotidiens) le font.
     */
    String EXECUTED_METRIC = "automation.flow.executed";

    /**
     * Declenche l'evaluation des regles actives de l'organisation pour ce trigger.
     *
     * @param trigger declencheur metier (ex. RESERVATION_BOOKED, NOISE_ALERT)
     * @param orgId   organisation concernee (jamais null)
     * @param subject sujet generique du declenchement (idempotence + conditions)
     */
    void fireTrigger(AutomationTrigger trigger, Long orgId, AutomationSubject subject);
}
