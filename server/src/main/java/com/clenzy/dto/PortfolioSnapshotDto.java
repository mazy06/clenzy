package com.clenzy.dto;

import java.util.List;

/**
 * Snapshot AGRÉGÉ de supervision pour la vue portefeuille (toutes les propriétés
 * d'une organisation). Sérialisé tel quel côté front en {@code PortfolioSnapshot}
 * (types.ts) — les noms de champs doivent rester alignés au contrat TypeScript.
 */
public record PortfolioSnapshotDto(
        String scope,            // toujours "portfolio"
        int propertyCount,
        boolean online,
        String globalAutonomy,   // "suggest" | "notify" | "full"
        boolean paused,
        List<AgentRollup> agents,
        List<PendingCard> pending,
        List<FeedEntry> feed,
        DayMetrics dayMetrics) {

    /** Agrégat d'un agent (com/rev/ops/fin/rep) sur tout le parc. */
    public record AgentRollup(
            String id,
            String status,        // "veille" | "wait" | ...
            String autonomy,      // "suggest" | "notify" | "full"
            int propertyCount,    // nb de logements où l'agent a une action en attente
            String task,          // synthèse ("3 action(s) en attente")
            List<AgentItem> items) {}

    /** Ventilation d'un agent par logement (tooltip / drawer). */
    public record AgentItem(
            String propertyId,
            String propertyName,
            String status,
            String task) {}

    /** Carte de la file portefeuille (suggestion en attente) + logement d'origine. */
    public record PendingCard(
            String id,
            String agentId,
            String title,
            String motif,
            String reasoning,
            String reservationId,
            String createdAt,
            String expiresAt,
            String applyActionType, // actionType si actionnable, sinon null
            Double amountEur,       // impact estimé (EUR), sinon null
            String propertyId,
            String propertyName) {}

    /** Entrée du journal portefeuille + logement d'origine. */
    public record FeedEntry(
            String id,
            String agentId,
            String at,
            String text,
            String toolName,
            String propertyName) {}

    /** Métriques d'en-tête (portefeuille). */
    public record DayMetrics(
            String timeSaved,
            int autoActions,
            int awaiting) {}
}
