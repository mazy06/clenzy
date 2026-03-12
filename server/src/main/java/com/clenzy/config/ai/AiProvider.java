package com.clenzy.config.ai;

/**
 * Interface d'abstraction pour les fournisseurs LLM (OpenAI, Anthropic).
 * Permet de switcher de provider par feature sans modifier les services metier.
 */
public interface AiProvider {

    /**
     * Nom du provider (ex: "openai", "anthropic").
     */
    String name();

    /**
     * Envoie une requete au LLM et retourne la reponse.
     * Utilise la cle API de la plateforme (configuration globale).
     *
     * @param request la requete LLM (system prompt, user prompt, parametres)
     * @return la reponse du LLM avec le contenu et les metriques de tokens
     * @throws AiProviderException en cas d'erreur de communication ou de parsing
     */
    AiResponse chat(AiRequest request);

    /**
     * Envoie une requete au LLM avec une cle API explicite (BYOK).
     * Construit un RestClient one-shot avec la cle fournie.
     *
     * @param request la requete LLM
     * @param apiKey  la cle API a utiliser (cle propre de l'organisation)
     * @return la reponse du LLM
     * @throws AiProviderException en cas d'erreur
     */
    default AiResponse chat(AiRequest request, String apiKey) {
        return chat(request);
    }
}
