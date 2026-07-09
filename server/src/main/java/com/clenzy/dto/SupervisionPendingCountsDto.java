package com.clenzy.dto;

import java.util.Map;

/**
 * Compteurs de suggestions HITL en attente (org-scopé) pour les pastilles du
 * planning : total de l'organisation (badge du menu « Planning ») et détail par
 * logement (badge de chaque cellule). Les clés de {@code byProperty} sont les
 * identifiants de logement (sérialisés en chaînes JSON).
 */
public record SupervisionPendingCountsDto(
        long total,
        Map<Long, Long> byProperty) {}
