package com.clenzy.dto.report;

/**
 * Decoupage d'une demande en documents.
 *
 * <p>Axe ORTHOGONAL au profil : une conciergerie veut tantot un releve
 * consolide de ses vingt biens, tantot vingt releves separes a envoyer chacun
 * a son proprietaire. Meme profil, meme periode, meme calcul — seul le
 * decoupage change.</p>
 */
public enum ReportGroupBy {

    /** Un document unique, tous biens confondus. */
    NONE,

    /** Un document par proprietaire, chacun limite a ses biens. */
    OWNER,

    /** Un document par bien. */
    PROPERTY
}
