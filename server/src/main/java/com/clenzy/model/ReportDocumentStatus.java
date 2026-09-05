package com.clenzy.model;

/**
 * Cycle de vie d'un rapport d'analyse.
 *
 * <p>Le passage par une relecture n'est pas une formalite : un commentaire
 * genere par un agent peut atteindre un proprietaire, et un texte errone sur
 * des montants est pire que pas de commentaire du tout. Le document reste donc
 * en {@link #DRAFT} jusqu'a validation humaine explicite.</p>
 */
public enum ReportDocumentStatus {

    /** Genere, commente, non relu. Rendu avec un filigrane « Brouillon ». */
    DRAFT,

    /** Relu et valide par un humain. Diffusable. */
    REVIEWED,

    /**
     * Transmis a son destinataire.
     *
     * <p>Un document envoye est IMMUABLE : toute reprise cree une nouvelle
     * version, jamais une modification en place. Sans cela, l'emetteur et le
     * destinataire discutent de deux documents portant le meme numero.</p>
     */
    SENT,

    /** Retire de la circulation ; conserve pour la tracabilite. */
    ARCHIVED
}
