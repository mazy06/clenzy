package com.clenzy.dto;

/**
 * Entrée de feed exposée au front (miroir du type {@code FeedEntry}).
 *
 * @param id      identifiant de l'entrée
 * @param agentId module/agent concerné (ex. {@code rev})
 * @param at      instant ISO-8601
 * @param text    libellé métier ("Revenue a ajusté le tarif…")
 */
public record SupervisionFeedEntryDto(
        String id,
        String agentId,
        String at,
        String text
) {
}
