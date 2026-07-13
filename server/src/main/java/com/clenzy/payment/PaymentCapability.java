package com.clenzy.payment;

/**
 * Capacités qu'un {@link PaymentProvider} peut supporter.
 *
 * <p>Permet au resolver ({@code PaymentOrchestrationService}) de ne jamais
 * router un flux vers un provider incapable de l'exécuter — remplace les
 * {@code UnsupportedOperationException} par une déclaration explicite (ISP).</p>
 *
 * <p>{@link #PAY} est la capacité de base de <strong>tout</strong> provider
 * de paiement ; le filtrage capacitaire ne s'active donc que pour les
 * capacités différenciantes (PREAUTH, PAYOUT, CUSTOMER…).</p>
 */
public enum PaymentCapability {

    /** Paiement / checkout one-shot. Base commune à tous les providers. */
    PAY,

    /** Pré-autorisation puis capture différée (caution / dépôt de garantie). */
    PREAUTH,

    /** Remboursement total ou partiel. */
    REFUND,

    /** Payout sortant initié via le provider (rare — voir {@code PayoutExecutor}). */
    PAYOUT,

    /** Profil client persistant / carte enregistrée (card-on-file). */
    CUSTOMER,

    /**
     * Checkout <strong>embarqué</strong> (inline) renvoyant un {@code clientSecret}
     * pour un composant de paiement côté client, plutôt qu'une redirection hébergée.
     * Capacité différenciante (Stripe Embedded Checkout) : les PSP régionaux ne la
     * déclarent pas → le resolver capability-aware réserve les flux embedded à Stripe.
     */
    EMBEDDED_CHECKOUT,

    /**
     * Abonnement <strong>récurrent</strong> (Stripe Billing, PayZone récurrent…).
     * Déclarée par les {@code SubscriptionProvider} ; sémantique distincte du
     * paiement one-shot (décision D1 de l'ADR : port abonnement dédié).
     */
    RECURRING,

    /**
     * Collecte d'<strong>adresse de livraison</strong> au checkout (biens physiques,
     * ex. shop matériel IoT). Déclarée par Stripe aujourd'hui ; un flux qui demande
     * {@code shippingAddressCountries} est routé vers un provider capable par le
     * resolver — <strong>sans épinglage en dur</strong> : le jour où un PSP expose la
     * collecte d'adresse, il suffit de déclarer cette capacité dans son adaptateur.
     */
    SHIPPING_ADDRESS
}
