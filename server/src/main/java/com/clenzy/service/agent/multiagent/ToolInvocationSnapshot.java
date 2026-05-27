package com.clenzy.service.agent.multiagent;

import java.util.Objects;

/**
 * Snapshot immutable d'un tool execute par un {@link AgentSpecialist}.
 *
 * <p>Permet au {@link OrchestratorAgent} d'agreger les ToolResults et de les
 * remonter a l'AgentOrchestrator, qui les forward au frontend en SSE
 * (events {@code tool_call_executed} → widgets KPI/table/charts).</p>
 *
 * <p>Sans ce snapshot, l'utilisateur ne verrait plus les visualisations
 * automatiques quand on passe du mono-agent au multi-agent (regression UX).</p>
 *
 * @param toolName    nom du tool execute (snake_case)
 * @param content     contenu JSON serialise du resultat
 * @param displayHint hint de rendu frontend ("summary", "table", "chart-bar",
 *                    "chart-line", "chart-pie", "insights", "navigation",
 *                    "portfolio", "weather", "events", "simulation",
 *                    "workflow", "knowledge"). Null = pas de widget.
 * @param isError     true si le tool a echoue (pas de widget, juste un message d'erreur)
 */
public record ToolInvocationSnapshot(
        String toolName,
        String content,
        String displayHint,
        boolean isError
) {
    public ToolInvocationSnapshot {
        Objects.requireNonNull(toolName, "toolName");
        Objects.requireNonNull(content, "content");
    }
}
