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

    /**
     * Planifie le menage manquant du depart de demain (agent Operations). Reutilise
     * {@code ServiceRequestService.createAutomaticCleaningRequest} (idempotent, org-validee,
     * ecriture DB uniquement). Params : {@code reservationId}, {@code checkIn}, {@code checkOut}
     * (ISO). N'est propose qu'aux logements en frequence AFTER_EACH_STAY (l'apply reussit alors
     * toujours) — cf. {@code CleaningBackfillScheduler.scanTomorrowCheckoutsMissingCleaning}.
     */
    public static final String CLEANING_REQUEST = "CLEANING_REQUEST";

    /**
     * Relance de paiement voyageur apres un echec (agent Finance). Regenere un lien
     * de paiement Stripe pour le solde du ({@code BookingBalanceService.createBalanceCheckoutUrl})
     * et l'envoie a l'email de paiement de la reservation. EFFET EXTERNE (Stripe + email) :
     * execute HORS transaction (regle audit n°2), compensation en cas d'echec. Params :
     * {@code reservationId}. L'email et le montant du sont RE-resolus a l'apply (regle audit n°1) ;
     * la carte n'est proposee que si un email de paiement est resoluble.
     */
    public static final String PAYMENT_REMINDER = "PAYMENT_REMINDER";

    /**
     * Génère un BROUILLON de réponse d'avis via LLM (agent Réputation, REP) et l'enregistre dans
     * {@code guest_reviews.host_response_draft} — JAMAIS publié automatiquement (l'opérateur valide,
     * édite, publie). EFFET EXTERNE (appel LLM) → exécuté hors transaction. Params : {@code reviewId}.
     */
    public static final String REVIEW_DRAFT_REPLY = "REVIEW_DRAFT_REPLY";

    /**
     * Relance la réassignation d'une demande de ménage dont le prestataire s'est
     * désisté (agent Operations). Réutilise {@code ServiceRequestService.attemptAutoAssign}
     * (écriture DB + notifications in-app uniquement) : « Appliquer » retente la
     * recherche d'équipe/prestataire disponible ; idempotent si la demande a été
     * réassignée entre-temps (scheduler 15 min). Params : {@code serviceRequestId}.
     */
    public static final String REASSIGN_CLEANING = "REASSIGN_CLEANING";

    private SupervisionActionType() {}
}
