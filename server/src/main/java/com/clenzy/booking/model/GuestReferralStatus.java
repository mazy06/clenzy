package com.clenzy.booking.model;

/** État d'un lien de parrainage (2.11). */
public enum GuestReferralStatus {
    /** Filleul rattaché, séjour pas encore terminé → crédit en attente. */
    PENDING,
    /** Séjour terminé → parrain et filleul crédités. */
    GRANTED
}
