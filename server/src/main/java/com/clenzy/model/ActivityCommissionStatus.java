package com.clenzy.model;

/** Cycle de vie d'une commission d'activité affiliée. */
public enum ActivityCommissionStatus {
    /** Enregistrée (réservation détectée), en attente de confirmation fournisseur. */
    PENDING,
    /** Confirmée par le fournisseur (réservation honorée). */
    CONFIRMED,
    /** Part hôte versée. */
    PAID,
    /** Annulée / remboursée par le voyageur. */
    CANCELLED
}
