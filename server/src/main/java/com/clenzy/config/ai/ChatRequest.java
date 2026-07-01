package com.clenzy.config.ai;

import java.util.List;

/**
 * Requete chat multi-turn avec support tools, independante du provider.
 *
 * <p>Distinct de {@link AiRequest} (single-turn historique) :
 * <ul>
 *   <li>{@link #messages} porte l'historique conversationnel (user/assistant/tool)</li>
 *   <li>{@link #tools} liste les outils que le LLM peut decider d'appeler</li>
 *   <li>Le streaming est gere par {@link ChatLLMProvider#streamChat}</li>
 * </ul>
 *
 * <p>{@link AiRequest} reste utilise par les features single-turn existantes
 * (intent detection, sentiment analysis, pricing predictions, etc.).</p>
 *
 * @param systemPrompt        instructions globales stables (prefixe cacheable, hors historique)
 * @param messages            historique conversationnel (user/assistant/tool)
 * @param tools               outils disponibles (null ou vide = pas de function calling)
 * @param model               identifiant du modele (ex: "claude-3-5-sonnet-20241022"). Null = defaut du provider.
 * @param temperature         creativite (0.0 = deterministe, 1.0 = creatif)
 * @param maxTokens           tokens max en sortie pour la prochaine completion
 * @param volatileSystemSuffix complement system dynamique (memoire/RAG/contexte). Null = system mono-bloc.
 *                            Quand present, le provider l'emet comme un 2e bloc system NON cache,
 *                            apres le prefixe stable cache — voir prompt caching Anthropic.
 * @param provider            hint de routage : "anthropic" | "openai" | "nvidia" | "bedrock" ...
 *                            Null = anthropic (defaut). Lu par {@link ChatLLMRouter} pour choisir
 *                            l'implementation {@link ChatLLMProvider} (Anthropic vs OpenAI-compatible).
 * @param baseUrl             base URL du provider (ex: NVIDIA Build, proxy Bedrock). Null = defaut
 *                            du provider. Utilise par les providers OpenAI-compatibles.
 */
public record ChatRequest(
        String systemPrompt,
        List<ChatMessage> messages,
        List<ToolDescriptor> tools,
        String model,
        double temperature,
        int maxTokens,
        String volatileSystemSuffix,
        String provider,
        String baseUrl
) {

    public ChatRequest {
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("ChatRequest.messages cannot be empty");
        }
        messages = List.copyOf(messages);
        tools = tools == null ? List.of() : List.copyOf(tools);
    }

    /**
     * Surcharge retro-compatible (system mono-bloc, pas de suffixe volatil, provider par defaut).
     * La majorite des appelants (specialistes multi-agent, tests) n'ont pas
     * besoin de scinder le system : ils passent par ce constructeur.
     */
    public ChatRequest(String systemPrompt, List<ChatMessage> messages, List<ToolDescriptor> tools,
                       String model, double temperature, int maxTokens) {
        this(systemPrompt, messages, tools, model, temperature, maxTokens, null, null, null);
    }

    /** Surcharge retro-compatible (system scinde, provider par defaut). */
    public ChatRequest(String systemPrompt, List<ChatMessage> messages, List<ToolDescriptor> tools,
                       String model, double temperature, int maxTokens, String volatileSystemSuffix) {
        this(systemPrompt, messages, tools, model, temperature, maxTokens, volatileSystemSuffix, null, null);
    }

    /**
     * Retourne une copie de cette requete avec un modele different.
     * Utilise pour les overrides BYOK / platform routing.
     */
    public ChatRequest overrideModel(String newModel) {
        return new ChatRequest(systemPrompt, messages, tools, newModel, temperature, maxTokens,
                volatileSystemSuffix, provider, baseUrl);
    }

    /**
     * Retourne une copie ciblant un provider + base URL specifiques (routage assistant
     * multi-provider : anthropic / openai / modeles plateforme OpenAI-compatibles).
     */
    public ChatRequest withTarget(String provider, String baseUrl) {
        return new ChatRequest(systemPrompt, messages, tools, model, temperature, maxTokens,
                volatileSystemSuffix, provider, baseUrl);
    }

    /**
     * Retourne une copie SANS outils exposes. Utilise pour forcer un tour de synthese
     * textuelle (le modele ne peut plus appeler d'outils) — ex. repli gracieux quand la
     * boucle d'outils atteint son plafond d'iterations.
     */
    public ChatRequest withoutTools() {
        return new ChatRequest(systemPrompt, messages, List.of(), model, temperature, maxTokens,
                volatileSystemSuffix, provider, baseUrl);
    }

    /**
     * Retourne une copie avec un message supplementaire ajoute a l'historique.
     * Utilise par l'orchestrateur pour construire la prochaine iteration de la boucle.
     */
    public ChatRequest withAppendedMessage(ChatMessage message) {
        java.util.ArrayList<ChatMessage> next = new java.util.ArrayList<>(messages);
        next.add(message);
        return new ChatRequest(systemPrompt, next, tools, model, temperature, maxTokens,
                volatileSystemSuffix, provider, baseUrl);
    }
}
