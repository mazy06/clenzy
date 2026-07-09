package com.clenzy.dto;

/**
 * Entrée de feed exposée au front (miroir du type {@code FeedEntry}).
 *
 * @param id       identifiant de l'entrée
 * @param agentId  module/agent concerné (ex. {@code rev})
 * @param at       instant ISO-8601
 * @param text     libellé métier de repli (résumé porté par l'outil, ou humanisé)
 * @param toolName nom stable de l'outil (clé i18n front : {@code supervision.tools.<toolName>})
 */
public record SupervisionFeedEntryDto(
        String id,
        String agentId,
        String at,
        String text,
        String toolName
) {
}
