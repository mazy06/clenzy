package com.clenzy.model;

/**
 * Codes des types de vente additionnelle references NOMMEMENT dans le code.
 *
 * <p>Le referentiel vit en base ({@link UpsellTypeDef}) et s'enrichit sans
 * deploiement. Mais quelques codes sont cherches par leur nom — l'agent de
 * supervision ne peut pas deviner lequel des soixante-dix-huit types designe
 * une arrivee anticipee. Ces constantes sont ce contrat-la, et rien de plus :
 * les ajouter ici n'ouvre aucun type, cela nomme ceux dont le code DEPEND.</p>
 */
public final class UpsellTypes {

    private UpsellTypes() {}

    public static final String EARLY_CHECKIN = "EARLY_CHECKIN";
    public static final String LATE_CHECKOUT = "LATE_CHECKOUT";

    /** Repli lorsqu'un code est absent, vide ou inconnu du referentiel. */
    public static final String OTHER = "OTHER";
}
