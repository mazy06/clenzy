package com.clenzy.service.agent.multiagent;

/**
 * Signal de pause HITL natif du flow multi-agent : un specialist a rencontré un
 * tool {@code requiresConfirmation} et l'{@link OrchestratorAgent} a capturé
 * l'état complet ({@link MultiAgentPendingContext}) nécessaire pour reprendre
 * EN MULTI-AGENT après la décision utilisateur.
 *
 * <p>Distincte de {@link ConfirmationRequiredException} :</p>
 * <ul>
 *   <li>{@link ConfirmationRequiredException} est levée par le SPECIALIST et ne
 *       connaît que son propre état (historique specialist + tool call).</li>
 *   <li>{@code MultiAgentConfirmationPauseException} est levée par l'ORCHESTRATOR
 *       après avoir enrichi avec l'état d'orchestration (messages orchestrateur
 *       + id du {@code delegate_to}).</li>
 * </ul>
 *
 * <p>Capturée par {@code MultiAgentFlowRunner.tryFlow} qui persiste le
 * contexte dans {@code PendingToolStore} et expose la confirmation au user
 * (events SSE), SANS fallback mono-agent.</p>
 */
public class MultiAgentConfirmationPauseException extends RuntimeException {

    private final transient MultiAgentPendingContext pendingContext;

    public MultiAgentConfirmationPauseException(MultiAgentPendingContext pendingContext) {
        super("Multi-agent flow paused on confirmation tool '"
                + pendingContext.pendingToolCall().name() + "'");
        this.pendingContext = pendingContext;
    }

    public MultiAgentPendingContext pendingContext() {
        return pendingContext;
    }

    public String toolName() {
        return pendingContext.pendingToolCall().name();
    }
}
