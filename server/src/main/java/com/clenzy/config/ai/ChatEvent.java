package com.clenzy.config.ai;

import java.util.List;

/**
 * Evenement emis par {@link ChatLLMProvider#streamChat} pendant le streaming
 * d'une reponse LLM.
 *
 * <p>Le provider emet des {@link TextDelta} au fil du flux, eventuellement des
 * {@link ToolCallRequest} si le modele decide d'appeler des outils, puis un
 * unique {@link Done} a la fin (ou {@link Error} si le stream a echoue).</p>
 *
 * <p>Sealed interface pour pattern matching exhaustif cote orchestrateur.</p>
 */
public sealed interface ChatEvent
        permits ChatEvent.TextDelta,
                ChatEvent.ToolCallRequest,
                ChatEvent.Done,
                ChatEvent.Error {

    /**
     * Fragment de texte recu en streaming. Le {@code delta} doit etre concatene
     * aux precedents pour reconstituer le texte complet de la reponse.
     */
    record TextDelta(String delta) implements ChatEvent {
    }

    /**
     * Le modele demande l'execution d'outils. Emis une seule fois en fin de stream,
     * juste avant {@link Done}, quand {@code stop_reason == "tool_use"} (Anthropic)
     * ou {@code finish_reason == "tool_calls"} (OpenAI).
     */
    record ToolCallRequest(List<ChatMessage.ToolCall> calls) implements ChatEvent {
        public ToolCallRequest {
            calls = List.copyOf(calls);
        }
    }

    /**
     * Fin du stream. Contient les metriques d'usage et la raison d'arret.
     *
     * @param promptTokens     tokens en entree (input)
     * @param completionTokens tokens en sortie (output)
     * @param model            identifiant du modele effectivement utilise
     * @param finishReason     "stop", "tool_use", "length", "end_turn", etc.
     * @param fullText         texte concatene de tous les TextDelta emis (commodite pour la persistance)
     */
    record Done(
            int promptTokens,
            int completionTokens,
            String model,
            String finishReason,
            String fullText
    ) implements ChatEvent {
    }

    /**
     * Erreur durant le stream. Le consommateur doit considerer le stream comme termine
     * apres reception d'un Error (pas de Done a suivre).
     */
    record Error(String message, Throwable cause) implements ChatEvent {
    }
}
