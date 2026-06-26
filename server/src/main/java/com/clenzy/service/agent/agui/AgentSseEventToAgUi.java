package com.clenzy.service.agent.agui;

import com.clenzy.service.agent.AgentSseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Traduit le flux interne {@link AgentSseEvent} (assistant Clenzy) vers les
 * événements du protocole {@link AgUiEvent} consommés par le front CopilotKit.
 *
 * <p><b>Stateful</b> : une instance par run. Suit le message texte courant
 * (bracketing TextMessageStart/End) et mémorise le dernier
 * {@code tool_confirmation_request} pour le restituer en interrupt HITL.</p>
 *
 * <p>Mapping :</p>
 * <ul>
 *   <li>{@code text_delta} → TextMessageStart (1×) + TextMessageContent</li>
 *   <li>{@code tool_call_executed} → ToolCallStart/End + ToolCallResult (avec displayHint)</li>
 *   <li>{@code tool_confirmation_request} → ToolCallStart/Args/End (+ mémorise l'interrupt)</li>
 *   <li>{@code paused_awaiting_confirmation} → RunFinished(outcome=interrupt)</li>
 *   <li>{@code done} → RunFinished(outcome=success) ; {@code error} → RunError</li>
 *   <li>{@code conversation_created} → StateSnapshot{conversationId}</li>
 *   <li>{@code agent_activity} → StateSnapshot{agentActivity:{specialist,phase,toolName?,task?}}
 *       (alimente la constellation Superviseur sans toucher au flux texte/tools)</li>
 * </ul>
 */
public final class AgentSseEventToAgUi {

    private final String runId = "run-" + UUID.randomUUID();
    private final String threadId;
    private final ObjectMapper objectMapper;

    /** Id du message texte en cours (null = aucun message texte ouvert). */
    private String textMessageId;
    /** Dernier tool en attente de confirmation, restitué dans l'interrupt. */
    private Map<String, Object> pendingInterrupt;

    public AgentSseEventToAgUi(String threadId, ObjectMapper objectMapper) {
        this.threadId = threadId;
        this.objectMapper = objectMapper;
    }

    public String runId() {
        return runId;
    }

    /** Événement d'ouverture du run (à émettre avant de lancer l'orchestrateur). */
    public List<AgUiEvent> onStart() {
        List<AgUiEvent> out = new ArrayList<>(1);
        out.add(AgUiEvent.runStarted(threadId, runId));
        return out;
    }

    /** Traduit un événement interne en 0..n événements AG-UI. */
    public List<AgUiEvent> translate(AgentSseEvent e) {
        List<AgUiEvent> out = new ArrayList<>(3);
        switch (e.type()) {
            case "conversation_created" -> {
                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.put("conversationId", e.conversationId());
                out.add(AgUiEvent.stateSnapshot(snapshot));
            }
            case "agent_activity" -> {
                // Etat partagé → constellation Superviseur. Le front lit
                // snapshot.agentActivity et mappe le specialist (nom reel) vers
                // un agent constellation. N'altere ni le texte ni les tools.
                Map<String, Object> activity = new LinkedHashMap<>();
                activity.put("specialist", e.toolName());
                activity.put("phase", e.finishReason());
                if (e.displayHint() != null) {
                    activity.put("toolName", e.displayHint());
                }
                if (e.toolResult() != null) {
                    activity.put("task", e.toolResult());
                }
                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.put("agentActivity", activity);
                out.add(AgUiEvent.stateSnapshot(snapshot));
            }
            case "text_delta" -> {
                if (textMessageId == null) {
                    textMessageId = "msg-" + UUID.randomUUID();
                    out.add(AgUiEvent.textMessageStart(textMessageId));
                }
                out.add(AgUiEvent.textMessageContent(textMessageId, e.delta()));
            }
            case "tool_call_executed" -> {
                String callId = e.toolCallId() != null ? e.toolCallId() : "tool-" + UUID.randomUUID();
                out.add(AgUiEvent.toolCallStart(callId, e.toolName(), textMessageId));
                out.add(AgUiEvent.toolCallEnd(callId));
                out.add(AgUiEvent.toolCallResult(
                        "tmsg-" + UUID.randomUUID(), callId,
                        wrapResult(e.displayHint(), e.toolResult(), Boolean.TRUE.equals(e.toolError()))));
            }
            case "tool_confirmation_request" -> {
                String callId = e.toolCallId() != null ? e.toolCallId() : "tool-" + UUID.randomUUID();
                out.add(AgUiEvent.toolCallStart(callId, e.toolName(), textMessageId));
                if (e.toolArgs() != null) {
                    out.add(AgUiEvent.toolCallArgs(callId, e.toolArgs()));
                }
                out.add(AgUiEvent.toolCallEnd(callId));
                Map<String, Object> interrupt = new LinkedHashMap<>();
                // `id` (requis) = toolCallId : le client renvoie cet id dans
                // ResumeEntry.interruptId au resume (cf. AgUiController.firstText).
                interrupt.put("id", callId);
                interrupt.put("reason", e.toolName() != null ? e.toolName() : "confirmation_required");
                interrupt.put("message", e.toolDescription());
                interrupt.put("toolCallId", callId);
                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("toolName", e.toolName());
                meta.put("args", e.toolArgs());
                interrupt.put("metadata", meta);
                this.pendingInterrupt = interrupt;
            }
            case "paused_awaiting_confirmation" -> {
                closeTextIfOpen(out);
                List<Map<String, Object>> interrupts = new ArrayList<>(1);
                if (pendingInterrupt != null) {
                    interrupts.add(pendingInterrupt);
                }
                out.add(AgUiEvent.runFinishedInterrupt(threadId, runId, interrupts));
            }
            case "done" -> {
                closeTextIfOpen(out);
                out.add(AgUiEvent.runFinishedSuccess(threadId, runId));
            }
            case "error" -> {
                // Un echec LLM/outil ne doit JAMAIS laisser le chat muet : CopilotKit
                // n'affiche pas RunError comme bulle (silence cote user). On rend
                // l'erreur comme un message assistant VISIBLE, humanise pour les cas
                // connus (rate-limit 429, cle invalide, timeout), puis on cloture le
                // run proprement (success) pour ne pas bloquer l'input.
                String friendly = humanizeError(e.error());
                if (textMessageId == null) {
                    textMessageId = "msg-" + UUID.randomUUID();
                    out.add(AgUiEvent.textMessageStart(textMessageId));
                }
                out.add(AgUiEvent.textMessageContent(textMessageId, friendly));
                closeTextIfOpen(out);
                out.add(AgUiEvent.runFinishedSuccess(threadId, runId));
            }
            default -> {
                // type inconnu : ignoré silencieusement (forward-compatible).
            }
        }
        return out;
    }

    /**
     * Transforme un message d'erreur technique en texte utilisateur lisible (FR).
     * Evite de fuiter "nvidia API returned status 429" : les cas connus ont un
     * libelle dedie, sinon un repli generique honnete.
     */
    static String humanizeError(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.contains("429") || r.contains("too many requests")
                || r.contains("rate") || r.contains("transient exhausted")) {
            return "Le service IA est momentanément saturé (trop de requêtes en peu de temps). "
                    + "Patiente quelques secondes puis réessaie.";
        }
        if (r.contains("401") || r.contains("403") || r.contains("unauthorized")
                || r.contains("invalid api key")) {
            return "La configuration du modèle IA semble invalide (clé API). "
                    + "Vérifie la configuration dans Paramètres > IA.";
        }
        if (r.contains("timeout") || r.contains("timed out")) {
            return "Le service IA met trop de temps à répondre. Réessaie dans un instant.";
        }
        return "Une erreur est survenue côté service IA. Réessaie dans un instant.";
    }

    private void closeTextIfOpen(List<AgUiEvent> out) {
        if (textMessageId != null) {
            out.add(AgUiEvent.textMessageEnd(textMessageId));
            textMessageId = null;
        }
    }

    /**
     * Emballe le résultat d'un tool avec son {@code displayHint} pour que le front
     * CopilotKit (useRenderTool) choisisse le composant génératif adapté.
     */
    private String wrapResult(String displayHint, String toolResult, boolean isError) {
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("displayHint", displayHint);
        wrapper.put("isError", isError);
        wrapper.put("data", parseOrRaw(toolResult));
        try {
            return objectMapper.writeValueAsString(wrapper);
        } catch (Exception ex) {
            return toolResult == null ? "" : toolResult;
        }
    }

    /** Le résultat d'outil est déjà du JSON : on le ré-injecte structuré (sinon brut). */
    private Object parseOrRaw(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return json;
        }
    }
}
