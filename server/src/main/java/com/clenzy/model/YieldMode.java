package com.clenzy.model;

/**
 * Mode d'exécution du yield v1 (F8a) — cadran de confiance progressif PAR ORG.
 *
 * <ul>
 *   <li>{@link #SIMULATION} : rapport de ce qui AURAIT changé (journal seul,
 *       zéro écriture tarifaire) ;</li>
 *   <li>{@link #SUGGEST} : suggestion HITL actionnable (montant re-calculé à
 *       l'apply), l'opérateur applique ou rejette ;</li>
 *   <li>{@link #AUTO} : application automatique sous bornes (plancher/plafond
 *       par bien + cap de variation journalier).</li>
 * </ul>
 */
public enum YieldMode {
    SIMULATION,
    SUGGEST,
    AUTO
}
