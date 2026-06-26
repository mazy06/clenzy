package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.service.agent.AgentContext;

import java.util.List;
import java.util.Objects;

/**
 * Snapshot de continuation du flow multi-agent suspendu sur une confirmation
 * utilisateur (HITL natif).
 *
 * <p>Quand un specialist tente d'invoquer un tool {@code requiresConfirmation},
 * on ne fallback PLUS sur le mono-agent : on capture exactement ce qu'il faut
 * pour <b>re-entrer dans le multi-agent</b> après la décision user, sans
 * rejouer les LLM calls / tools déjà effectués.</p>
 *
 * <p><b>Deux niveaux d'état</b> capturés au moment de la pause :</p>
 * <ul>
 *   <li><b>Specialist</b> : {@link #specialistName} + {@link #specialistHistory}
 *       (jusqu'au tour de pause inclus, le dernier message étant l'assistant
 *       qui demande le tool). À la reprise, on injecte le tool result et on
 *       laisse le specialist finir sa boucle → produit sa {@code synthesis}.</li>
 *   <li><b>Orchestrator</b> : {@link #orchestratorMessages} (historique du LLM
 *       orchestrateur jusqu'à l'appel {@code delegate_to} inclus) +
 *       {@link #delegateToolCallId} (l'id du call {@code delegate_to} qui a
 *       déclenché le specialist). À la reprise, la synthesis du specialist est
 *       réinjectée comme tool_result de ce {@code delegate_to}, et la boucle
 *       d'orchestration reprend → réponse finale.</li>
 * </ul>
 *
 * <p>{@link #pendingToolCall} est le tool call concret (id + name + args) à
 * exécuter si l'utilisateur confirme.</p>
 *
 * <p><b>Immutable</b> : toutes les listes sont copiées défensivement.</p>
 *
 * @param specialistName       nom du specialist en pause (pour le re-résoudre
 *                             depuis le {@link SpecialistRegistry} à la reprise)
 * @param specialistHistory    historique conversationnel du specialist jusqu'au
 *                             tour de pause inclus (system prompt exclu)
 * @param pendingToolCall      tool call à confirmer (id + name + arguments JSON)
 * @param orchestratorMessages historique du LLM orchestrateur jusqu'à l'appel
 *                             {@code delegate_to} inclus
 * @param delegateToolCallId   id du tool_call {@code delegate_to} de l'orchestrateur
 * @param effectiveContext     AgentContext effectif au moment de la pause
 *                             (provider/modèle/baseUrl résolus). Au resume on
 *                             reprend le JWT/identité depuis le contexte courant
 *                             mais on conserve la cible LLM résolue ici.
 */
public record MultiAgentPendingContext(
        String specialistName,
        List<ChatMessage> specialistHistory,
        ChatMessage.ToolCall pendingToolCall,
        List<ChatMessage> orchestratorMessages,
        String delegateToolCallId,
        AgentContext effectiveContext
) {
    public MultiAgentPendingContext {
        Objects.requireNonNull(specialistName, "specialistName");
        Objects.requireNonNull(pendingToolCall, "pendingToolCall");
        Objects.requireNonNull(delegateToolCallId, "delegateToolCallId");
        specialistHistory = (specialistHistory == null) ? List.of() : List.copyOf(specialistHistory);
        orchestratorMessages = (orchestratorMessages == null) ? List.of() : List.copyOf(orchestratorMessages);
    }
}
