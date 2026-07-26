package com.clenzy.dto;

import java.util.List;

/**
 * Etat de l'inventaire RLS — plan REM-T-01.
 *
 * @param auditActif        l'instrumentation tourne-t-elle
 * @param mesureExploitable l'aspect pose-t-il les GUC. Si non, l'inventaire est SANS VALEUR :
 *                          sans GUC, toutes les requetes sont signalees, pas seulement les
 *                          chemins a risque. Ce drapeau evite de lire un inventaire trompeur.
 * @param rlsDejaActive     la RLS est-elle deja posee en base
 * @param cheminsOuverts    nombre de chemins non traites — zero est la condition d'activation
 * @param enAttente         constats en memoire pas encore persistes
 * @param sature            le tampon a-t-il atteint son plafond (inventaire incomplet)
 */
public record RlsAuditSummaryDto(
        boolean auditActif,
        boolean mesureExploitable,
        boolean rlsDejaActive,
        long cheminsOuverts,
        int enAttente,
        boolean sature,
        List<RlsAuditFindingDto> chemins
) {}
