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
    ASSISTANT_CHAT
}
