package com.clenzy.dto;

/**
 * Entrée de feed exposée au front (miroir du type {@code FeedEntry}).
 *
 * @param id           identifiant de l'entrée
 * @param agentId      module/agent concerné (ex. {@code rev})
 * @param at           instant ISO-8601
 * @param text         libellé métier de repli (résumé porté par l'outil, ou humanisé)
 * @param toolName     nom stable de l'outil (clé i18n front : {@code supervision.tools.<toolName>})
 * @param messageLogId id du {@code GuestMessageLog} lié (envois de message uniquement), pour
 *                     prévisualiser le contenu envoyé à la demande ; {@code null} sinon
 * @param invoiceId    id de la facture liée (relances de paiement uniquement), pour ouvrir
 *                     la modale de détail facture (payer / envoyer un lien) ; {@code null} sinon
 */
public record SupervisionFeedEntryDto(
        String id,
        String agentId,
        String at,
        String text,
        String toolName,
        Long messageLogId,
        Long invoiceId
) {
}
