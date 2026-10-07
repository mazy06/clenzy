package com.clenzy.booking.model;

/** Type d'écriture de crédit fidélité (2.8). */
public enum GuestCreditTxType {
    /** Gain : X% d'un séjour direct terminé. */
    EARN,
    /** Rédemption : crédit appliqué à un nouveau séjour (réduit le montant payé). */
    REDEEM,
    /** Reprise : annulation d'un séjour ayant généré ou consommé du crédit. */
    CLAWBACK,
    /** Crédit accordé manuellement par l'hôte (geste commercial). */
    GRANT,
    /** Annulation de la fraction d'une récompense correspondant à un remboursement confirmé. */
    EARN_REVERSAL,
    /** Restitution de la fraction de remise consommée correspondant au remboursement du séjour. */
    REDEEM_RETURN
}
