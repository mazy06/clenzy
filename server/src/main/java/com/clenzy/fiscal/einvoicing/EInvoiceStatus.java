package com.clenzy.fiscal.einvoicing;

/**
 * Statut d'une soumission d'e-invoicing (CLZ-P0-04).
 */
public enum EInvoiceStatus {
    /** Aucune contrainte d'e-invoicing pour ce pays. */
    NOT_REQUIRED,
    /** Artefact conforme rendu (XML/PDF) mais pas encore transmis. */
    RENDERED,
    /** En attente de retour de l'autorite (clearance/reporting async). */
    PENDING,
    /** Facture validee (clearance temps reel) par l'autorite. */
    CLEARED,
    /** Facture declaree (reporting differe) a l'autorite. */
    REPORTED,
    /** Echec — voir message ; reconciliation requise. */
    FAILED
}
