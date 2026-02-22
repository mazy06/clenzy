package com.clenzy.model;

/**
 * Type de plan tarifaire.
 *
 * Resolution de prix (ordre de priorite) :
 * 1. RateOverride (prix specifique par date)
 * 2. PROMOTIONAL (offres speciales)
 * 3. SEASONAL (tarifs saisonniers)
 * 4. LAST_MINUTE (tarifs derniere minute)
 * 5. BASE (tarif de base)
 * 6. Property.nightlyPrice (fallback compatibilite arriere)
 */
public enum RatePlanType {
    BASE,           // Tarif de base (fallback)
    SEASONAL,       // Tarif saisonnier (ete, hiver, etc.)
    PROMOTIONAL,    // Offre promotionnelle (priorite haute)
    LAST_MINUTE     // Tarif derniere minute
}
