package com.clenzy.service.agent.supervision;

/**
 * Types d'action exécutables portés par une suggestion de la constellation.
 *
 * <p>Une suggestion sans {@code actionType} reste informationnelle (l'opérateur
 * lit + rejette). Avec un type ci-dessous, la carte HITL propose « Appliquer »
 * → exécution serveur idempotente (cf. {@link SuggestionActionExecutor}).</p>
 */
public final class SupervisionActionType {

    /**
     * Baisse de tarif sur une plage : applique un override de prix par date
     * (prix courant résolu × (1 − percent)). Params : {@code from}, {@code to}
     * (ISO, {@code to} exclusif), {@code percent} (entier, ex. 12 = −12 %).
     */
    public static final String PRICE_DROP = "PRICE_DROP";

    private SupervisionActionType() {}
}
