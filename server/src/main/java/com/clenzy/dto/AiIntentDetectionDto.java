package com.clenzy.dto;

import java.util.List;

/**
 * Resultat de detection d'intent via LLM.
 *
 * @param intent     intent detectee (CHECK_IN, PROBLEM, etc.)
 * @param confidence confiance (0.0-1.0)
 * @param language   langue detectee (fr, en, ar, etc.)
 * @param entities   entites extraites (dates, lieux, etc.)
 * @param urgent     si le message est urgent
 */
public record AiIntentDetectionDto(
        String intent,
        double confidence,
        String language,
        List<String> entities,
        boolean urgent
) {
}
