package com.clenzy.dto.report;

/**
 * Nature d'une section — ce qui dit aux trois rendus comment la dessiner.
 *
 * <p>Le snapshot ne porte ni HTML ni composant : il decrit ce qu'il y a a
 * montrer, et chaque rendu le traduit dans son langage (tuiles a l'ecran, SVG
 * dans le PDF, texte pour l'agent).</p>
 */
public enum ReportSectionKind {

    /** Rangee de chiffres cles avec leurs variations. */
    KPI_ROW,

    /** Tableau de donnees, avec ligne de totaux optionnelle. */
    TABLE,

    /** Graphique seul. */
    CHART,

    /** Graphique et tableau cote a cote : la forme et le detail. */
    CHART_TABLE,

    /**
     * Compte de resultat en cascade — revenus bruts jusqu'au net proprietaire.
     *
     * <p>Distinct d'un TABLE : ses lignes s'enchainent par soustraction, et le
     * rendu doit marquer les sous-totaux et le resultat final.</p>
     */
    PNL,

    /** Liste de constats ou d'actions, chacun avec sa portee. */
    LIST,

    /**
     * Definitions des indicateurs.
     *
     * <p>Sans glossaire, « RevPAR » fait decrocher un proprietaire non
     * professionnel : le document impressionne au lieu d'informer.</p>
     */
    GLOSSARY,

    /** Texte seul — methodologie, mentions, note de perimetre. */
    NOTICE
}
