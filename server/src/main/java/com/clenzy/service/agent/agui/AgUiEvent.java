package com.clenzy.service.agent.agui;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Un événement du protocole AG-UI (<a href="https://docs.ag-ui.com">docs.ag-ui.com</a>),
 * consommé par le front CopilotKit.
 *
 * <p>Le payload est une map ordonnée (champ {@code type} en tête, nuls omis) que
 * le contrôleur sérialise en JSON et frame sur le flux SSE : {@code data: {json}}.
 * Le client AG-UI discrimine sur le champ {@code type} — valeurs exactes en
 * <b>UPPER_SNAKE_CASE</b> (vérifiées sur {@code @ag-ui/core} {@code EventType}).</p>
 *
 * <p>Schémas (vérifiés) : RUN_STARTED/RUN_FINISHED exigent {@code threadId}+{@code runId} ;
 * RUN_FINISHED porte un {@code outcome} discriminé (success | interrupt) ; un
 * interrupt = {@code {id, reason, message?, toolCallId?, ...}}.</p>
 */
public record AgUiEvent(Map<String, Object> payload) {

    private static Map<String, Object> base(String type) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        return m;
    }

    // ─── Cycle de vie du run ─────────────────────────────────────────────────

    public static AgUiEvent runStarted(String threadId, String runId) {
        Map<String, Object> m = base("RUN_STARTED");
        m.put("threadId", threadId);
        m.put("runId", runId);
        return new AgUiEvent(m);
    }

    public static AgUiEvent runFinishedSuccess(String threadId, String runId) {
        Map<String, Object> m = base("RUN_FINISHED");
        m.put("threadId", threadId);
        m.put("runId", runId);
        m.put("outcome", Map.of("type", "success"));
        return new AgUiEvent(m);
    }

    /** Run interrompu pour validation humaine (HITL) : le front rend l'UI d'approbation. */
    public static AgUiEvent runFinishedInterrupt(String threadId, String runId, List<Map<String, Object>> interrupts) {
        Map<String, Object> outcome = new LinkedHashMap<>();
        outcome.put("type", "interrupt");
        outcome.put("interrupts", interrupts);
        Map<String, Object> m = base("RUN_FINISHED");
        m.put("threadId", threadId);
        m.put("runId", runId);
        m.put("outcome", outcome);
        return new AgUiEvent(m);
    }

    public static AgUiEvent runError(String message) {
        Map<String, Object> m = base("RUN_ERROR");
        m.put("message", message == null ? "" : message);
        return new AgUiEvent(m);
    }

    // ─── Messages texte (streaming) ──────────────────────────────────────────

    public static AgUiEvent textMessageStart(String messageId) {
        Map<String, Object> m = base("TEXT_MESSAGE_START");
        m.put("messageId", messageId);
        m.put("role", "assistant");
        return new AgUiEvent(m);
    }

    public static AgUiEvent textMessageContent(String messageId, String delta) {
        Map<String, Object> m = base("TEXT_MESSAGE_CONTENT");
        m.put("messageId", messageId);
        m.put("delta", delta == null ? "" : delta);
        return new AgUiEvent(m);
    }

    public static AgUiEvent textMessageEnd(String messageId) {
        Map<String, Object> m = base("TEXT_MESSAGE_END");
        m.put("messageId", messageId);
        return new AgUiEvent(m);
    }

    // ─── Tool calls ──────────────────────────────────────────────────────────

    public static AgUiEvent toolCallStart(String toolCallId, String toolCallName, String parentMessageId) {
        Map<String, Object> m = base("TOOL_CALL_START");
        m.put("toolCallId", toolCallId);
        m.put("toolCallName", toolCallName);
        if (parentMessageId != null) {
            m.put("parentMessageId", parentMessageId);
        }
        return new AgUiEvent(m);
    }

    public static AgUiEvent toolCallArgs(String toolCallId, String delta) {
        Map<String, Object> m = base("TOOL_CALL_ARGS");
        m.put("toolCallId", toolCallId);
        m.put("delta", delta == null ? "" : delta);
        return new AgUiEvent(m);
    }

    public static AgUiEvent toolCallEnd(String toolCallId) {
        Map<String, Object> m = base("TOOL_CALL_END");
        m.put("toolCallId", toolCallId);
        return new AgUiEvent(m);
    }

    /** Résultat d'un tool. {@code content} = JSON {displayHint, isError, data} (cf. translator). */
    public static AgUiEvent toolCallResult(String messageId, String toolCallId, String content) {
        Map<String, Object> m = base("TOOL_CALL_RESULT");
        m.put("messageId", messageId);
        m.put("toolCallId", toolCallId);
        m.put("content", content == null ? "" : content);
        m.put("role", "tool");
        return new AgUiEvent(m);
    }

    // ─── État partagé (→ constellation côté front, Phase 2) ──────────────────

    public static AgUiEvent stateSnapshot(Map<String, Object> snapshot) {
        Map<String, Object> m = base("STATE_SNAPSHOT");
        m.put("snapshot", snapshot);
        return new AgUiEvent(m);
    }
}
