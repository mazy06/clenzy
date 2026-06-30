package com.clenzy.dto;

import java.util.List;

/**
 * Snapshot d'activité réelle d'une propriété (feed + compteur), consommé par
 * le front pour remplacer les valeurs mock du header/journal.
 *
 * @param feed        dernières entrées d'activité (chrono inversé)
 * @param autoActions nb d'actions des dernières 24h (compteur header)
 */
public record SupervisionActivitySnapshotDto(
        List<SupervisionFeedEntryDto> feed,
        int autoActions
) {
}
