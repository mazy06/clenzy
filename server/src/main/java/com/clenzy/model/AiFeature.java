package com.clenzy.model;

/**
 * Enum des features AI disponibles.
 * Chaque feature correspond a un service AI avec son propre budget et tracking.
 */
public enum AiFeature {
    DESIGN,
    PRICING,
    MESSAGING,
    ANALYTICS,
    SENTIMENT,
    /** Generation de contenu marketing (descriptions de biens, meta SEO) multilingue. */
    CONTENT,
    /**
     * Assistant de creation « champ IA » du Studio booking engine et du livret d'accueil :
     * analyse de site (design), import d'annonce, generation de sections de livret. Toggle + budget
     * propres pour piloter cette aide a la creation independamment des autres features.
     */
    STUDIO_ASSIST,
    /**
     * Assistant conversationnel (chat orchestrator + specialists) + briefings.
     * Tracking par tour user : 1 record AiTokenUsage par message assistant
     * persiste, alimente le badge frontend "consommation cumulee USD / mois".
     */
    ASSISTANT_CHAT,
    /**
     * Tier PETIT de l'assistant (T-03/ADR-004, pilote en base depuis 2026-07-02) :
     * modele economique des roles utilitaires (classification IntentRouter,
     * rolling summary X6, specialists SMALL). Assigner un modele plateforme a
     * cette feature ACTIVE le tiering ; non assignee = comportement inchange
     * (modele du contexte). Garde meme-provider : le tier ne s'applique que si
     * son provider correspond a celui resolu — la cle du contexte (BYOK incluse)
     * est reutilisee telle quelle, jamais celle du modele tier.
     */
    ASSISTANT_SMALL,
    /**
     * Tier FORT de l'assistant (T-03/ADR-004) : modele haut de gamme des roles
     * d'analyse (Insights). Memes regles qu'{@link #ASSISTANT_SMALL}.
     */
    ASSISTANT_STRONG,
    /**
     * Embeddings RAG (recherche semantique de la knowledge base).
     * Modele PLATFORM-GLOBAL : la dimension de l'index pgvector {@code kb_chunk} est figee
     * (1024d), donc pas de BYOK org (qui melangerait des modeles de dimensions differentes).
     * Resolu par {@code EmbeddingService} via la config DB (provider voyage/openai + cle + baseUrl) —
     * plus aucune cle en variable d'environnement. Le rerank Voyage reutilise cette cle.
     */
    EMBEDDINGS
}
