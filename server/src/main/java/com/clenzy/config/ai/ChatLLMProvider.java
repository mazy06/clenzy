package com.clenzy.config.ai;

import java.util.function.Consumer;

/**
 * Provider chat multi-turn avec support streaming et tool-calling.
 *
 * <p>Distinct de {@link AiProvider} (single-turn historique). Les deux peuvent coexister :
 * {@link AiProvider} continue de servir les features non-conversationnelles (intent,
 * sentiment, pricing), {@link ChatLLMProvider} sert l'assistant conversationnel.</p>
 *
 * <p><b>Contrat de streaming</b> : l'implementation lit le flux SSE/chunked du provider
 * et emet des {@link ChatEvent} en temps reel via le {@code Consumer}. La methode
 * {@link #streamChat} bloque l'appelant jusqu'a la fin du stream (le consommateur est
 * appele dans le thread appelant — l'orchestrateur le repousse vers son SseEmitter).</p>
 *
 * <p><b>Securite</b> : les implementations ne loggent jamais l'apiKey, jamais les
 * contenus de messages en entier (au plus la taille/role). Les clients restent
 * lazy-init pour ne pas casser au boot si la cle plateforme est absente.</p>
 */
public interface ChatLLMProvider {

    /** Nom du provider (ex: "anthropic", "openai"). */
    String name();

    /**
     * Envoie une requete chat avec la cle plateforme et stream les evenements.
     *
     * @param request  requete chat multi-turn (messages, tools, model, ...)
     * @param consumer callback appele pour chaque evenement (text delta, tool call, done, error)
     * @throws AiProviderException en cas d'erreur de communication / parsing
     */
    void streamChat(ChatRequest request, Consumer<ChatEvent> consumer);

    /**
     * Variante BYOK : envoie la requete avec une cle API explicite (cle de l'organisation).
     * Construit un client one-shot avec la cle fournie.
     *
     * @param request  requete chat
     * @param consumer callback streaming
     * @param apiKey   cle API de l'organisation (BYOK). Si null/vide, fallback sur la cle plateforme.
     */
    default void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        streamChat(request, consumer);
    }
}
