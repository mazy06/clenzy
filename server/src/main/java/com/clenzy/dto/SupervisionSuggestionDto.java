package com.clenzy.dto;

/**
 * Suggestion org-scopée exposée au front (mappée vers {@code PendingAction}).
 *
 * @param id            identifiant (clé de rejet)
 * @param agentId       module/agent à l'origine (ex. {@code rev})
 * @param title         intitulé métier ("Baisser le tarif du 20–22 juil. de −12 %")
 * @param motif         motif court / raison
 * @param reservationId réservation concernée (optionnel)
 * @param createdAt     ISO-8601
 * @param expiresAt     ISO-8601 (la suggestion peut expirer)
 */
public record SupervisionSuggestionDto(
        String id,
        String agentId,
        String title,
        String motif,
        Long reservationId,
        String createdAt,
        String expiresAt
) {
}
