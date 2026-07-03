package com.clenzy.service.agent;

/**
 * Tier de modele LLM par role d'agent (campagne multi-agent, ticket T-03 —
 * ADR-004 : tiering pilote par configuration, jamais hardcode).
 *
 * <p>Matrice de reference (Phase 1 de la campagne) :</p>
 * <ul>
 *   <li>{@link #SMALL} — taches mecaniques a sortie courte : classification
 *       d'intention (routeur T-02), specialists utilitaires (Navigation,
 *       Memory, Context, Workflow), resumes, briefings ;</li>
 *   <li>{@link #STANDARD} — raisonnement metier courant : mono-agent,
 *       orchestrateur, majorite des specialists. C'est le tier par defaut =
 *       le modele resolu pour ASSISTANT_CHAT (comportement historique) ;</li>
 *   <li>{@link #STRONG} — mandats ou l'erreur coute des euros reels : Insights
 *       (yield/simulations), futurs agents Conformite et Incident.</li>
 * </ul>
 *
 * <p>Le mapping tier → modele est PAR PROVIDER (une org BYOK OpenAI ne peut
 * pas recevoir un id Claude) et vit dans {@link TierModelResolver}
 * ({@code clenzy.assistant.tiering.*}).</p>
 */
public enum AgentTier {
    SMALL,
    STANDARD,
    STRONG
}
