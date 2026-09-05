package com.clenzy.dto.report;

/**
 * A qui le document s'adresse — ce qui change son perimetre, son contenu et son ton.
 *
 * <p>Un seul moteur, trois profils : le meme calcul, trois lectures. Melanger
 * les trois dans un document unique donne un rapport que personne ne lit —
 * trop technique pour un proprietaire, trop pedagogique pour l'equipe, et
 * indiffusable a un prospect.</p>
 */
public enum ReportProfile {

    /**
     * Le proprietaire d'une conciergerie, sur SES biens uniquement.
     *
     * <p>Porte le compte de resultat net proprietaire et l'encart « ce que nous
     * avons fait » qui justifie la commission. Ton pedagogique, glossaire inclus :
     * le destinataire n'est pas un professionnel de l'hebergement.</p>
     */
    OWNER,

    /**
     * L'equipe interne, sur tout le portefeuille.
     *
     * <p>Dense et sans fard : marges, benchmark entre biens, charge operationnelle.
     * Pas de glossaire — l'audience connait le vocabulaire.</p>
     */
    INTERNAL,

    /**
     * Un prospect commercial, sur un perimetre ANONYMISE.
     *
     * <p>Noms masques et montants indexes : diffuser les revenus reels d'un
     * proprietaire a un tiers est une fuite de donnees, quelle que soit
     * l'intention commerciale.</p>
     */
    PROSPECT
}
