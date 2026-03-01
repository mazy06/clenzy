package com.clenzy.model;

/**
 * Type de plan tarifaire.
 *
 * Resolution de prix (ordre de priorite) :
 * 1. RateOverride (prix specifique par date)
 * 2. PROMOTIONAL / EVENT (offres speciales, evenements)
 * 3. SEASONAL / WEEKEND (tarifs saisonniers, week-end)
 * 4. EARLY_BIRD / LAST_MINUTE (tarifs anticipation / derniere minute)
 * 5. LONG_STAY / OCCUPANCY_BASED (remises duree / taux remplissage)
 * 6. BASE (tarif de base)
 * 7. Property.nightlyPrice (fallback compatibilite arriere)
 */
public enum RatePlanType {
    BASE,              // Tarif de base (fallback)
    SEASONAL,          // Tarif saisonnier (ete, hiver, etc.)
    PROMOTIONAL,       // Offre promotionnelle (priorite haute)
    LAST_MINUTE,       // Tarif derniere minute
    EARLY_BIRD,        // Reservation X jours a l'avance
    WEEKEND,           // Tarifs vendredi-dimanche
    LONG_STAY,         // Remises hebdomadaires/mensuelles
    OCCUPANCY_BASED,   // Varie selon le nombre de voyageurs
    EVENT              // Evenements locaux (festivals, conferences)
}
