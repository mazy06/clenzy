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
        String toolDescription
) {

    public static AgentSseEvent conversationCreated(Long id) {
        return new AgentSseEvent("conversation_created", null, id, null, null, null, null, null, null, null, null);
    }

    public static AgentSseEvent textDelta(String delta) {
        return new AgentSseEvent("text_delta", delta, null, null, null, null, null, null, null, null, null);
    }

    public static AgentSseEvent toolCallExecuted(String name, String callId, boolean isError, String hint) {
        return new AgentSseEvent("tool_call_executed", null, null, name, callId, isError, hint, null, null, null, null);
    }

    /**
     * Tool d'ecriture qui attend confirmation utilisateur. Le frontend doit
     * afficher un dialog avec un recap des args et envoyer une reponse au
     * backend via {@code POST /assistant/tool-confirm}.
     */
    public static AgentSseEvent toolConfirmationRequest(String name, String callId,
                                                         String toolArgs, String toolDescription) {
        return new AgentSseEvent("tool_confirmation_request", null, null, name, callId,
                null, null, null, null, toolArgs, toolDescription);
    }

    /**
     * Marque la fin du stream en attendant la reponse utilisateur. Pas de "done"
     * apres : le client doit gerer cet etat comme un "stream en pause".
     */
    public static AgentSseEvent pausedAwaitingConfirmation() {
        return new AgentSseEvent("paused_awaiting_confirmation", null, null, null, null,
                null, null, null, null, null, null);
    }

    public static AgentSseEvent done(String finishReason) {
        return new AgentSseEvent("done", null, null, null, null, null, null, finishReason, null, null, null);
    }

    public static AgentSseEvent error(String message) {
        return new AgentSseEvent("error", null, null, null, null, null, null, null, message, null, null);
    }
}
