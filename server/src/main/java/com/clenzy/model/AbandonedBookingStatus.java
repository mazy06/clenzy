package com.clenzy.model;

/** Cycle de vie d'un panier abandonné (CLZ Domaine 2 — récupération de panier). */
public enum AbandonedBookingStatus {
    /** Réservation pending expirée, en attente d'email de relance. */
    PENDING,
    /** Email de relance envoyé. */
    RECOVERY_SENT,
    /** Le voyageur a finalement réservé (récupéré). */
    RECOVERED
}
