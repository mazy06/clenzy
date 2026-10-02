package com.clenzy.model;

/**
 * Usage d'un logement loue en courte duree en France — il fixe les obligations.
 *
 * <ul>
 *   <li>{@link #RESIDENCE_PRINCIPALE} : plafond annuel de nuitees (120 par defaut,
 *       abaissable a 90 par la commune — Code du tourisme L324-1-1 IV).</li>
 *   <li>{@link #RESIDENCE_SECONDAIRE} et {@link #MEUBLE_DEDIE} : pas de plafond,
 *       mais numero d'enregistrement et, selon la commune, changement d'usage.</li>
 *   <li>{@link #CHAMBRE_HOTES} : regime distinct (declaration en mairie, L324-4),
 *       hors numero d'enregistrement des meubles de tourisme.</li>
 * </ul>
 */
public enum FrRentalUse {
    RESIDENCE_PRINCIPALE,
    RESIDENCE_SECONDAIRE,
    MEUBLE_DEDIE,
    CHAMBRE_HOTES
}
