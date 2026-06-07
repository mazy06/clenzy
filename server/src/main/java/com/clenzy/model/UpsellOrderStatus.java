package com.clenzy.model;

/** Cycle de vie d'une commande d'upsell (paiement Stripe). */
public enum UpsellOrderStatus {
    /** Session Stripe créée, paiement pas encore confirmé. */
    PENDING,
    /** Paiement confirmé (webhook checkout.session.completed). */
    PAID,
    /** Abandonnée / expirée sans paiement. */
    CANCELLED,
    /** Remboursée après paiement. */
    REFUNDED
}
