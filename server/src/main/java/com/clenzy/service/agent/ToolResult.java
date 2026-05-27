package com.clenzy.service.agent;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Resultat d'execution d'un tool.
 *
 * <p>{@link #content} est le payload structure (souvent un JSON serialise)
 * renvoye au LLM. Le LLM lit ce contenu et formule sa reponse en langage naturel.</p>
 *
 * <p>{@link #displayHint} est un hint optionnel pour le frontend afin de rendre
 * un widget specifique (ex: "list", "summary", "table"). Si null, le frontend
 * affiche seulement la reponse textuelle du LLM.</p>
 *
 * <p>{@link #isError} signale au LLM que l'execution a echoue. L'orchestrateur
 * marque le {@code tool_result} avec {@code is_error: true} cote Anthropic
 * pour que le LLM puisse retry ou expliquer l'erreur.</p>
 *
 * @param content     contenu serialise renvoye au LLM (typiquement JSON, mais accepte du texte libre)
 * @param displayHint hint optionnel pour le rendu frontend ("list", "table", "summary", ...)
 * @param isError     true si l'execution a echoue
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ToolResult(
        String content,
        String displayHint,
        boolean isError
) {

    /** Resultat de succes texte ou JSON serialise. */
    public static ToolResult success(String content) {
        return new ToolResult(content, null, false);
    }

    /** Resultat de succes avec hint d'affichage. */
    public static ToolResult success(String content, String displayHint) {
        return new ToolResult(content, displayHint, false);
    }

    /** Resultat d'erreur avec message lisible par le LLM. */
    public static ToolResult error(String message) {
        return new ToolResult(message, null, true);
    }
}
