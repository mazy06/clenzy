package com.clenzy.service.agent;

import java.time.Instant;

/**
 * Vue read-only d'une action en attente de validation (HITL), destinée au
 * frontend pour ré-afficher les confirmations en suspens après un reload de page.
 *
 * <p>Record DTO immutable — n'expose AUCUNE entité JPA ni l'état de reprise
 * (historique conversationnel, JWT, contexte multi-agent), qui restent côté
 * serveur dans {@link PendingToolStore}. Le front n'a besoin que de l'identité
 * de l'action + un résumé lisible pour réafficher le dialog de confirmation.</p>
 *
 * @param toolCallId     id du tool_use (clé de reprise via {@code resume.interruptId})
 * @param toolName       nom du tool sensible en attente (ex. {@code cancel_reservation})
 * @param description    description courte du tool (issue du {@code ToolDescriptor})
 * @param argsSummary    résumé JSON compact des arguments proposés (peut être null)
 * @param conversationId conversation à laquelle l'action est rattachée
 * @param createdAt      instant de mise en pause (ordonnancement côté front)
 * @param specialistName nom du specialist qui a demandé l'action (ex. {@code data_analyst}),
 *                       {@code null} en mono-agent. Permet au front de rattacher l'action à
 *                       l'agent constellation correspondant (cf. specialistMapping).
 */
public record PendingActionDto(
        String toolCallId,
        String toolName,
        String description,
        String argsSummary,
        Long conversationId,
        Instant createdAt,
        String specialistName
) {
}
