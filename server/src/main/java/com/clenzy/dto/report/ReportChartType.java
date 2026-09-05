package com.clenzy.dto.report;

/**
 * Formes de graphique que le module sait dessiner dans les TROIS rendus.
 *
 * <p>Volontairement court : chaque forme ajoutee doit etre tracee a la fois par
 * le kit de l'ecran et par le generateur SVG du PDF. Une forme qui n'existe que
 * d'un cote romprait la promesse « ce qu'on voit est ce qu'on envoie ».</p>
 */
public enum ReportChartType {

    /** Barres verticales groupees — comparer des series categorie par categorie. */
    BARS,

    /** Barres verticales empilees — un total et sa composition. */
    STACKED_BARS,

    /** Barres horizontales — les libelles sont des noms, qui ne pivotent pas. */
    HORIZONTAL_BARS,

    /** Courbes — evolution de series sans unite commune a additionner. */
    LINES,

    /** Aires empilees — un volume et sa composition dans le temps. */
    AREA,

    /** Anneau — une repartition, avec son total au centre. */
    DONUT
}
