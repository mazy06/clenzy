package com.clenzy.service.agent;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Evenement emis cote SSE vers le frontend.
 *
 * <p>Type unique avec {@link #type} discriminant (plus simple a serialiser qu'une
 * sealed interface pour Jackson). Le frontend matche sur {@link #type} :</p>
 * <ul>
 *   <li>{@code conversation_created} : id de conv assignee pour les nouveaux threads</li>
 *   <li>{@code text_delta} : fragment de texte recu en streaming</li>
 *   <li>{@code tool_call_executed} : recap d'un tool read-only execute</li>
 *   <li>{@code tool_confirmation_request} : un tool requiresConfirmation attend
 *       confirmation utilisateur — le stream se met en pause cote backend.
 *       Le frontend doit afficher un dialog avec {@link #toolArgs} et appeler
 *       {@code POST /assistant/tool-confirm} pour reprendre l'execution.</li>
 *   <li>{@code done} : fin du tour, raison d'arret incluse</li>
 *   <li>{@code error} : erreur (le stream se termine apres)</li>
 *   <li>{@code paused_awaiting_confirmation} : terminal — le stream est suspendu,
 *       le frontend doit attendre la reponse user. Pas de Done apres.</li>
 *   <li>{@code agent_activity} : activite d'un agent du moteur multi-agent
 *       (specialist demarre / reflechit / agit / termine). Purement informatif :
 *       alimente la constellation « Superviseur d'agents » cote front. N'altere
 *       PAS le flux texte/tools. Champs portes : {@link #toolName} = nom du
 *       specialist (snake_case reel : data_analyst, communication, ...),
 *       {@link #finishReason} = phase (started | thinking | acting | done),
 *       {@link #displayHint} = nom de l'outil concerne quand phase=acting (sinon
 *       null), {@link #toolResult} = libelle metier court de la tache (optionnel).</li>
 * </ul>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentSseEvent(
        String type,
        String delta,
        Long conversationId,
        String toolName,
        String toolCallId,
        Boolean toolError,
        String displayHint,
        String finishReason,
        String error,
        String toolArgs,
        String toolDescription,
        /**
         * Contenu serialise (JSON typiquement) retourne par le tool. Le frontend
         * le parse et rend un widget contextualise selon {@link #displayHint}
         * (KpiSummaryWidget pour "summary", DataTableWidget pour "list", etc.).
         * Null pour les tools en erreur (l'UI affiche juste l'erreur via toolError).
         */
        String toolResult,
        /**
         * Identifiant du run persiste (agent_run, campagne T-05). Emis une fois
         * en debut de run via {@code run_started} ; null sur les autres events.
         */
        String runId
) {

    public static AgentSseEvent conversationCreated(Long id) {
        return new AgentSseEvent("conversation_created", null, id, null, null, null, null, null, null, null, null, null, null);
    }

    public static AgentSseEvent textDelta(String delta) {
        return new AgentSseEvent("text_delta", delta, null, null, null, null, null, null, null, null, null, null, null);
    }

    public static AgentSseEvent toolCallExecuted(String name, String callId, boolean isError,
                                                  String hint, String toolResult) {
        return new AgentSseEvent("tool_call_executed", null, null, name, callId, isError, hint,
                null, null, null, null, toolResult, null);
    }

    /**
     * Tool d'ecriture qui attend confirmation utilisateur. Le frontend doit
     * afficher un dialog avec un recap des args et envoyer une reponse au
     * backend via {@code POST /assistant/tool-confirm}.
     */
    public static AgentSseEvent toolConfirmationRequest(String name, String callId,
                                                         String toolArgs, String toolDescription) {
        return new AgentSseEvent("tool_confirmation_request", null, null, name, callId,
                null, null, null, null, toolArgs, toolDescription, null, null);
    }

    /**
     * Marque la fin du stream en attendant la reponse utilisateur. Pas de "done"
     * apres : le client doit gerer cet etat comme un "stream en pause".
     */
    public static AgentSseEvent pausedAwaitingConfirmation() {
        return new AgentSseEvent("paused_awaiting_confirmation", null, null, null, null,
                null, null, null, null, null, null, null, null);
    }

    /**
     * Activite d'un agent du moteur multi-agent (constellation Superviseur).
     *
     * @param specialist nom reel du specialist (snake_case : data_analyst, communication, ...)
     *                   ou {@code "orchestrator"} pour l'orchestrateur lui-meme
     * @param phase      cycle de vie : {@code started}, {@code thinking}, {@code acting}, {@code done}
     * @param toolName   nom de l'outil concerne quand phase={@code acting} (sinon null)
     * @param task       libelle metier court de la tache en cours (optionnel, sans jargon LLM)
     */
    public static AgentSseEvent agentActivity(String specialist, String phase,
                                              String toolName, String task) {
        return new AgentSseEvent("agent_activity", null, null, specialist, null,
                null, toolName, phase, null, null, null, task, null);
    }

    /**
     * Debut d'un run persiste (campagne T-05) : porte l'id d'agent_run pour que
     * le front puisse relier le stream courant au replay ({@code GET
     * /api/agui/history/{runId}}). Types inconnus ignores par les anciens fronts.
     */
    public static AgentSseEvent runStarted(String runId) {
        return new AgentSseEvent("run_started", null, null, null, null, null, null, null, null, null, null, null, runId);
    }

    public static AgentSseEvent done(String finishReason) {
        return new AgentSseEvent("done", null, null, null, null, null, null, finishReason, null, null, null, null, null);
    }

    public static AgentSseEvent error(String message) {
        return new AgentSseEvent("error", null, null, null, null, null, null, null, message, null, null, null, null);
    }
}
