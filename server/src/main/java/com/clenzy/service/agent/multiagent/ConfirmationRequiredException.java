package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatMessage;

import java.util.List;

/**
 * Levée par un {@link AgentSpecialist} quand il tente d'invoquer un tool dont
 * le descripteur a {@code requiresConfirmation=true}.
 *
 * <p><b>Deux usages, selon le constructeur utilisé</b> :</p>
 * <ol>
 *   <li><b>Signal de fallback (legacy)</b> — {@link #ConfirmationRequiredException(String)} :
 *       ne porte que le nom du tool. Utilisé quand le HITL natif multi-agent est
 *       désactivé : l'orchestrator + AgentOrchestrator fallbackent sur le mono-agent
 *       qui gère la pause-confirmation.</li>
 *   <li><b>Signal de pause résumable (HITL natif)</b> — constructeur enrichi :
 *       porte en plus l'historique de conversation du specialist jusqu'au point
 *       de pause + le tool call à exécuter après confirmation. L'orchestrator
 *       attache son propre état (cf. {@link MultiAgentPendingContext}) et
 *       AgentOrchestrator persiste le tout dans {@code PendingToolStore} pour
 *       reprendre EN MULTI-AGENT après la décision user.</li>
 * </ol>
 *
 * <p><b>Securite</b> : cette exception est un mecanisme de defense — si elle
 * n'etait pas levee, un user pourrait declencher des actions destructives
 * (cancel reservation, archive property) en posant simplement une question
 * au multi-agent qui les invoquerait silencieusement.</p>
 *
 * <p>{@link #hasResumeContext()} permet au caller de distinguer les deux modes
 * sans NullPointerException : le mode legacy laisse {@code specialistHistory}
 * et {@code toolCall} à null.</p>
 */
public class ConfirmationRequiredException extends RuntimeException {

    private final String toolName;

    /**
     * Historique de conversation du specialist jusqu'au point de pause (system
     * prompt non inclus — il est porté par le ChatRequest). Contient le dernier
     * message assistant avec le tool call à confirmer. {@code null} en mode
     * fallback legacy.
     */
    private final transient List<ChatMessage> specialistHistory;

    /** Le tool call à exécuter une fois confirmé. {@code null} en mode legacy. */
    private final transient ChatMessage.ToolCall toolCall;

    /** Mode fallback legacy : seul le nom du tool est connu. */
    public ConfirmationRequiredException(String toolName) {
        super("Tool '" + toolName + "' requires user confirmation — fallback to mono-agent");
        this.toolName = toolName;
        this.specialistHistory = null;
        this.toolCall = null;
    }

    /**
     * Mode pause résumable (HITL natif multi-agent).
     *
     * @param toolCall          le tool call à confirmer (porte id + name + args)
     * @param specialistHistory historique conversationnel du specialist jusqu'au
     *                          tour de pause INCLUS (dernier élément = assistant
     *                          tool_calls). Copié défensivement.
     */
    public ConfirmationRequiredException(ChatMessage.ToolCall toolCall,
                                         List<ChatMessage> specialistHistory) {
        super("Tool '" + toolCall.name() + "' requires user confirmation — pausing multi-agent flow");
        this.toolName = toolCall.name();
        this.toolCall = toolCall;
        this.specialistHistory = specialistHistory == null ? null : List.copyOf(specialistHistory);
    }

    public String toolName() {
        return toolName;
    }

    /** {@code true} si l'exception porte de quoi reprendre EN MULTI-AGENT. */
    public boolean hasResumeContext() {
        return toolCall != null && specialistHistory != null;
    }

    /** Tool call à exécuter après confirmation. {@code null} en mode legacy. */
    public ChatMessage.ToolCall toolCall() {
        return toolCall;
    }

    /** Historique du specialist jusqu'au point de pause. {@code null} en mode legacy. */
    public List<ChatMessage> specialistHistory() {
        return specialistHistory;
    }
}
