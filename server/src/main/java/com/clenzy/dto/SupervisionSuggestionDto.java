package com.clenzy.dto;

/**
 * Suggestion org-scopée exposée au front (mappée vers {@code PendingAction}).
 *
 * @param id                   identifiant (clé de rejet / d'application)
 * @param agentId              module/agent à l'origine (ex. {@code rev})
 * @param title                intitulé métier ("Baisser le tarif du 20–22 juil. de −12 %")
 * @param motif                motif court / raison
 * @param reservationId        réservation concernée (optionnel)
 * @param createdAt            ISO-8601
 * @param expiresAt            ISO-8601 (la suggestion peut expirer)
 * @param actionType           type d'action exécutable (ex. {@code PRICE_DROP}), ou {@code null} = informationnelle
 * @param estimatedImpactCents impact estimé en centimes EUR (optionnel)
 * @param severity             gravité indicative ({@code info}/{@code warning}/{@code critical}), optionnel
 * @param actionParams         paramètres bruts de l'action (JSON, ex. {@code {"segments":[…]}}) pour
 *                             préremplir la modale d'ajustement ; {@code null} si informationnelle
 * @param tool                 nom stable du scanner à l'origine (ex. {@code guest_email_missing}),
 *                             ou {@code null}. Discriminant côté front pour les cartes
 *                             informationnelles à comportement dédié (ex. ouvrir la fiche client).
 */
public record SupervisionSuggestionDto(
        String id,
        String agentId,
        String title,
        String motif,
        Long reservationId,
        String createdAt,
        String expiresAt,
        String actionType,
        Long estimatedImpactCents,
        String severity,
        String actionParams,
        String tool
) {
}
