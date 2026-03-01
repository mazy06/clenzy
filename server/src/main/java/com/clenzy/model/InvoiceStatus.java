package com.clenzy.model;

/**
 * Statut du cycle de vie d'une facture.
 * Les factures emises (ISSUED) sont immutables - corrections via CREDIT_NOTE.
 */
public enum InvoiceStatus {
    /** Brouillon, modifiable */
    DRAFT,
    /** Emise, immutable */
    ISSUED,
    /** Payee */
    PAID,
    /** Annulee */
    CANCELLED,
    /** Avoir / note de credit */
    CREDIT_NOTE
}
