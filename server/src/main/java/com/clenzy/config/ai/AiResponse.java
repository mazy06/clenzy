package com.clenzy.config.ai;

/**
 * Reponse LLM unifiee, independante du provider.
 *
 * @param content          le texte genere par le LLM
 * @param promptTokens     nombre de tokens dans le prompt
 * @param completionTokens nombre de tokens dans la completion
 * @param totalTokens      total prompt + completion
 * @param model            modele utilise (retourne par le provider)
 * @param finishReason     raison de fin (stop, length, etc.)
 */
public record AiResponse(
        String content,
        int promptTokens,
        int completionTokens,
        int totalTokens,
        String model,
        String finishReason
) {
}
