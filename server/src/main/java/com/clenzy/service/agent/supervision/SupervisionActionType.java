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

    /**
     * Remboursement de la caution d'une reservation ANNULEE (F2b) : libere le hold
     * Stripe (aucun debit). Params : {@code reservationId}, {@code depositId}
     * (indicatif). L'etat de la caution est RELU a l'apply — le montant affiche
     * dans la suggestion n'est jamais applique aveuglement (regle audit n°1).
     */
    public static final String DEPOSIT_REFUND = "DEPOSIT_REFUND";

    /**
     * Liberation de la caution encore retenue apres le depart (F4c). Meme effet
     * et memes garanties que {@link #DEPOSIT_REFUND} (hold Stripe annule,
     * transition CAS HELD → RELEASED, idempotency key deterministe).
     */
    public static final String DEPOSIT_RELEASE = "DEPOSIT_RELEASE";

    /**
     * Blocage du calendrier du logement apres incidents bruit (F6c). Params :
     * {@code days} (defaut 7, borne 1..30) — plage [aujourd'hui, aujourd'hui+days).
     * Refuse si des jours BOOKED existent dans la plage (CalendarEngine.block).
     */
    public static final String CALENDAR_BLOCK = "CALENDAR_BLOCK";

    /**
     * Ajustement yield v1 (F8a, mode SUGGEST) : applique un pourcentage SIGNE
     * ({@code percent} &lt; 0 = baisse, &gt; 0 = hausse) sur la plage
     * [{@code from}, {@code to}) — {@code ruleId} indicatif. Les prix sont
     * RE-resolus a l'apply et bornes par le plancher/plafond yield du bien
     * (regle audit n°1) ; cap « un apply par bien et par jour » via le journal
     * yield_adjustments (+ index unique partiel DB).
     */
    public static final String YIELD_PRICE_ADJUST = "YIELD_PRICE_ADJUST";

    private SupervisionActionType() {}
}
