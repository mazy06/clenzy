package com.clenzy.marketplace.model;

/**
 * Rythme d'une prestation.
 *
 * <p>C'est cet attribut qui transforme une prestation en <b>echeance</b>, donc
 * en relance automatique. Sans lui, un ramonage annuel obligatoire se gere
 * comme une demande ponctuelle : il s'oublie, et l'assurance refuse le sinistre.</p>
 */
public enum ServiceRecurrence {
    /** Une fois, sur demande. */
    ONE_OFF,
    /** A chaque sejour. */
    PER_STAY,
    WEEKLY,
    MONTHLY,
    /** Une ou deux fois par an, calee sur la saison (ouverture, hivernage). */
    SEASONAL,
    ANNUAL,
    /** Tous les plusieurs annees — la plupart des diagnostics immobiliers. */
    MULTI_YEAR;

    /** true si la prestation revient d'elle-meme et merite une relance datee. */
    public boolean isRecurring() {
        return this != ONE_OFF;
    }
}
