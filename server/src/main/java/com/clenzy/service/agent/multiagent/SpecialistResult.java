package com.clenzy.service.agent.multiagent;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Resultat immutable retourne par un {@link AgentSpecialist}.
 *
 * <p>Le {@code synthesis} est ce qui remonte a l'orchestrator (qui le combine
 * avec d'autres delegations + son propre reasoning pour produire la reponse
 * user finale).</p>
 *
 * <p>Les {@code toolCallsExecuted} servent a l'observability (count, tracing,
 * debug). Les {@code toolInvocations} portent les payloads complets (content +
 * displayHint) — l'AgentOrchestrator les forward au frontend en SSE pour
 * afficher les widgets visuels (KPI cards, tables, charts).</p>
 *
 * @param synthesis           texte de retour pour l'orchestrator (jamais null)
 * @param toolCallsExecuted   noms des tools invoques (jamais null) — observability
 * @param toolInvocations     snapshots complets pour forward au frontend (jamais null)
 * @param promptTokens        tokens consommés (input) — observability
 * @param completionTokens    tokens produits (output) — observability
 * @param truncated           true si max iterations atteintes (boucle bornee)
 * @param error               erreur si le specialiste a echoue (null = succes)
 */
public record SpecialistResult(
        String synthesis,
        List<String> toolCallsExecuted,
        List<ToolInvocationSnapshot> toolInvocations,
        int promptTokens,
        int completionTokens,
        boolean truncated,
        String error
) {
    public SpecialistResult {
        Objects.requireNonNull(synthesis, "synthesis");
        toolCallsExecuted = (toolCallsExecuted == null) ? List.of()
                : Collections.unmodifiableList(List.copyOf(toolCallsExecuted));
        toolInvocations = (toolInvocations == null) ? List.of()
                : Collections.unmodifiableList(List.copyOf(toolInvocations));
    }

    /** Helper : succes avec synthese + logs tools + snapshots. */
    public static SpecialistResult success(String synthesis,
                                             List<String> toolCalls,
                                             List<ToolInvocationSnapshot> toolInvocations,
                                             int promptTokens,
                                             int completionTokens) {
        return new SpecialistResult(synthesis, toolCalls, toolInvocations,
                promptTokens, completionTokens, false, null);
    }

    /** Helper retro-compat : succes sans snapshots. */
    public static SpecialistResult success(String synthesis, List<String> toolCalls,
                                             int promptTokens, int completionTokens) {
        return success(synthesis, toolCalls, List.of(), promptTokens, completionTokens);
    }

    /** Helper : succes mais boucle bornee atteinte (partial result). */
    public static SpecialistResult truncated(String synthesis, List<String> toolCalls,
                                               int promptTokens, int completionTokens) {
        return new SpecialistResult(synthesis, toolCalls, List.of(),
                promptTokens, completionTokens, true, null);
    }

    /** Helper : echec — l'orchestrator pourra retomber sur un fallback. */
    public static SpecialistResult error(String message) {
        return new SpecialistResult(
                "Le specialiste a echoue : " + message,
                List.of(), List.of(), 0, 0, false, message
        );
    }

    public boolean isSuccess() {
        return error == null;
    }
}
