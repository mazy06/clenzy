package com.clenzy.model;

/**
 * Categories de taxation applicables aux differents types de prestations.
 * Chaque categorie correspond a un taux de taxe specifique par pays.
 */
public enum TaxCategory {
    /** Hebergement touristique (taux reduit dans la plupart des pays) */
    ACCOMMODATION,
    /** Taux standard */
    STANDARD,
    /** Alimentation / restauration */
    FOOD,
    /** Services de nettoyage */
    CLEANING,
    /** Taxe de sejour / municipality fee */
    TOURIST_TAX
}
