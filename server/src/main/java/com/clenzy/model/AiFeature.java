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
    /**
     * Assistant conversationnel (chat orchestrator + specialists) + briefings.
     * Tracking par tour user : 1 record AiTokenUsage par message assistant
     * persiste, alimente le badge frontend "consommation cumulee USD / mois".
     */
    ASSISTANT_CHAT
}
