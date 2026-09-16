package com.clenzy.marketplace.model;

/**
 * Famille d'un metier.
 *
 * <p>Trente-deux pastilles de filtre sur une ligne ne se lisent plus. Groupees
 * par famille, elles se parcourent : on cherche d'abord « qui paie et pour
 * quoi », puis le metier.</p>
 */
public enum CategoryFamily {
    /** Exploitation quotidienne : menage, linge, cles, logistique, accueil. */
    OPERATIONS,
    /** Technique et reglementaire : maintenance, exterieurs, controles obligatoires. */
    TECHNICAL,
    /** Services vendus au voyageur : cuisine, transport, activites, bien-etre. */
    GUEST,
    /** Services vendus au proprietaire : photo, decoration, comptabilite, assurance. */
    OWNER,
    /** Hors classement. */
    OTHER
}
