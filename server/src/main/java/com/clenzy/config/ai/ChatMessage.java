package com.clenzy.config.ai;

import java.util.List;

/**
 * Message individuel dans une conversation multi-turn.
 *
 * <p>Modele unifie compatible avec les schemas Anthropic et OpenAI :
 * <ul>
 *   <li>{@code user} / {@code assistant} : texte standard (toolCalls null)</li>
 *   <li>{@code assistant} avec {@code toolCalls != null} : le modele demande l'execution d'outils</li>
 *   <li>{@code tool} : retour d'execution d'un outil, {@code toolCallId} identifie le call</li>
 * </ul>
 *
 * <p>Le {@code systemPrompt} n'est PAS un message : il est porte par {@link ChatRequest}
 * (les providers le passent en champ separe — Anthropic l'a en parametre {@code system},
 * OpenAI l'a comme premier message {@code role:"system"}).
 *
 * @param role       "user", "assistant" ou "tool"
 * @param content    texte du message (peut etre null si toolCalls est rempli)
 * @param toolCalls  liste des appels d'outils demandes (uniquement pour role=assistant)
 * @param toolCallId identifiant du tool_call auquel ce message repond (uniquement pour role=tool)
 */
public record ChatMessage(
        String role,
        String content,
        List<ToolCall> toolCalls,
        String toolCallId
) {

    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";
    public static final String ROLE_TOOL = "tool";

    /** Message utilisateur standard. */
    public static ChatMessage user(String content) {
        return new ChatMessage(ROLE_USER, content, null, null);
    }

    /** Message assistant texte (pas d'appel d'outil). */
    public static ChatMessage assistant(String content) {
        return new ChatMessage(ROLE_ASSISTANT, content, null, null);
    }

    /** Message assistant demandant l'execution d'outils. */
    public static ChatMessage assistantToolCalls(List<ToolCall> calls) {
        return new ChatMessage(ROLE_ASSISTANT, null, List.copyOf(calls), null);
    }

    /** Retour d'execution d'un outil. */
    public static ChatMessage tool(String toolCallId, String resultJson) {
        return new ChatMessage(ROLE_TOOL, resultJson, null, toolCallId);
    }

    /**
     * Demande d'execution d'un outil par le modele.
     *
     * @param id        identifiant unique du call (Anthropic: toolu_xxx, OpenAI: call_xxx)
     * @param name      nom du tool (doit matcher un {@link ToolDescriptor#name()})
     * @param arguments arguments serialises en JSON
     */
    public record ToolCall(String id, String name, String arguments) {
    }
}
