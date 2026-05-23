package com.clenzy.model;

/**
 * Méthodes de paiement supportées pour les reversements aux propriétaires.
 *
 * <p>Chaque méthode est associée à un {@code PayoutExecutor} via le pattern
 * Strategy (voir {@code com.clenzy.payment.payout.PayoutExecutor}).</p>
 *
 * <h2>Couverture par marché</h2>
 * <ul>
 *   <li>Europe (EUR) → STRIPE_CONNECT (auto) ou SEPA_TRANSFER (semi-auto) ou
 *       OPEN_BANKING (auto via PIS)</li>
 *   <li>Maroc / Arabie Saoudite / hors zone Stripe → WISE (auto, 80+ pays)</li>
 *   <li>Cas degrade → MANUAL (impossible automatiser)</li>
 * </ul>
 */
public enum PayoutMethod {
    /** Aucune automatisation : l'admin se débrouille hors Clenzy. */
    MANUAL,
    /** Stripe Connect Express : transfert auto vers compte connecté. EU + US + UK. */
    STRIPE_CONNECT,
    /** Génération XML pain.001 + upload manuel sur portail bancaire Clenzy. */
    SEPA_TRANSFER,
    /** Wise Business API : virement international auto, 80+ pays dont MA/KSA. */
    WISE,
    /**
     * Open Banking PIS (Payment Initiation Service) : virement auto SEPA
     * depuis le compte bancaire Clenzy, validation SCA mensuelle.
     */
    OPEN_BANKING
}
