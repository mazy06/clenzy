package com.clenzy.dto;

import java.util.List;

/**
 * Reponse suggeree generee par LLM.
 *
 * @param response     reponse principale suggeree
 * @param tone         ton detecte (friendly, professional, empathetic)
 * @param language     langue de la reponse
 * @param alternatives reponses alternatives
 */
public record AiSuggestedResponseDto(
        String response,
        String tone,
        String language,
        List<String> alternatives
) {
}
