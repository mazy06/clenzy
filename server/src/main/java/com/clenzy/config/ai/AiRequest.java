package com.clenzy.config.ai;

/**
 * Requete LLM unifiee, independante du provider.
 *
 * @param systemPrompt le prompt systeme (instructions)
 * @param userPrompt   le prompt utilisateur (contenu a traiter)
 * @param model        modele a utiliser (null = defaut du provider)
 * @param temperature  creativite (0.0 = deterministe, 1.0 = creatif)
 * @param maxTokens    nombre max de tokens en sortie
 * @param jsonMode     si true, force la reponse en JSON structure (OpenAI only)
 */
public record AiRequest(
        String systemPrompt,
        String userPrompt,
        String model,
        double temperature,
        int maxTokens,
        boolean jsonMode
) {

    /**
     * Cree une requete simple avec les valeurs par defaut
     * (temperature 0.3, max 2000 tokens, pas de JSON mode).
     */
    public static AiRequest of(String systemPrompt, String userPrompt) {
        return new AiRequest(systemPrompt, userPrompt, null, 0.3, 2000, false);
    }

    /**
     * Cree une requete en mode JSON avec les valeurs par defaut.
     */
    public static AiRequest json(String systemPrompt, String userPrompt) {
        return new AiRequest(systemPrompt, userPrompt, null, 0.3, 2000, true);
    }

    /**
     * Cree une requete avec un modele specifique.
     */
    public static AiRequest withModel(String systemPrompt, String userPrompt, String model) {
        return new AiRequest(systemPrompt, userPrompt, model, 0.3, 2000, false);
    }

    /**
     * Cree une requete avec des tokens max custom.
     */
    public static AiRequest withMaxTokens(String systemPrompt, String userPrompt, int maxTokens) {
        return new AiRequest(systemPrompt, userPrompt, null, 0.3, maxTokens, false);
    }

    /**
     * Retourne une copie de cette requete avec un modele different.
     * Utilise pour le model override BYOK.
     */
    public AiRequest overrideModel(String newModel) {
        return new AiRequest(systemPrompt, userPrompt, newModel, temperature, maxTokens, jsonMode);
    }
}
