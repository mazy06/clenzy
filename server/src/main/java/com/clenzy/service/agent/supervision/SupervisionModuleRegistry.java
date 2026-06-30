package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionAutonomy;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Catalogue des modules (agents) de la constellation Superviseur.
 *
 * <p>Source de vérité du catalogue côté backend. Built-in au départ
 * (com/rev/ops/fin/rep), conçu pour être <b>extensible</b> : un module importé
 * plus tard s'ajoute ici (ou via une future table de modules) et la config
 * org-level le référence par {@code key} sans changement de schéma.</p>
 *
 * <p>Le {@code labelKey} est une clé i18n (le rendu/libellé reste côté front).
 * {@code defaultAutonomy} = SUGGEST au lancement (décision produit : démarrage
 * conservateur — l'agent propose, l'humain valide).</p>
 */
@Component
public class SupervisionModuleRegistry {

    /** Un module du catalogue. */
    public record SupervisionModule(
            String key,
            String labelKey,
            SupervisionAutonomy defaultAutonomy,
            boolean builtin
    ) {}

    private static final List<SupervisionModule> BUILTINS = List.of(
            new SupervisionModule("com", "supervision.agents.com.name", SupervisionAutonomy.SUGGEST, true),
            new SupervisionModule("rev", "supervision.agents.rev.name", SupervisionAutonomy.SUGGEST, true),
            new SupervisionModule("ops", "supervision.agents.ops.name", SupervisionAutonomy.SUGGEST, true),
            new SupervisionModule("fin", "supervision.agents.fin.name", SupervisionAutonomy.SUGGEST, true),
            new SupervisionModule("rep", "supervision.agents.rep.name", SupervisionAutonomy.SUGGEST, true)
    );

    /**
     * Mapping specialist backend → module constellation (miroir Java de
     * specialistMapping.ts côté front). Les specialists techniques absents
     * (context/memory/navigation) → aucun module (activité non affichée).
     */
    private static final Map<String, String> SPECIALIST_TO_MODULE = Map.of(
            "communication", "com",
            "data_analyst", "rev",
            "operations", "ops",
            "monitoring", "ops",
            "workflow", "ops",
            "insights", "rep",
            "finance", "fin"
    );

    /** Catalogue complet (ordre canonique). */
    public List<SupervisionModule> all() {
        return BUILTINS;
    }

    /** Module constellation pour un specialist backend, ou {@code null} si masqué/inconnu. */
    public String moduleForSpecialist(String specialist) {
        return specialist == null ? null : SPECIALIST_TO_MODULE.get(specialist);
    }

    public Optional<SupervisionModule> find(String key) {
        return BUILTINS.stream().filter(m -> m.key().equals(key)).findFirst();
    }

    /** {@code true} si la clé fait partie du catalogue connu. */
    public boolean isKnown(String key) {
        return find(key).isPresent();
    }
}
