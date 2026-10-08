package com.clenzy.model;

/** Cycle de vie d'une commission d'activité affiliée. */
public enum ActivityCommissionStatus {
    /** Enregistrée (réservation détectée), en attente de confirmation fournisseur. */
    PENDING,
    /** Confirmée par le fournisseur (réservation honorée). */
    CONFIRMED,
    /** Ancien statut sans preuve de réception : à rapprocher, pas une preuve bancaire. */
    PAID,
    /** Commission reçue du programme, part hôte attribuée au journal. Pas un virement bancaire à l'hôte. */
    RECEIVED,
    /** Annulée / remboursée par le voyageur. */
    CANCELLED
}
