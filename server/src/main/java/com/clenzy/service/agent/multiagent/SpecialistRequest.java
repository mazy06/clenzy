package com.clenzy.service.agent.multiagent;

import com.clenzy.service.agent.AgentContext;

import java.util.Objects;

/**
 * Requête immutable envoyée à un {@link AgentSpecialist}.
 *
 * @param query           question/tache deleguee par l'orchestrator (jamais null/blank)
 * @param context         identite + tenant + UI hints (jamais null)
 * @param parentTraceId   identifiant de trace de l'orchestrator (observabilite,
 *                        permet de regrouper les LLM calls dans Datadog/Sentry)
 *                        null OK (pas de tracing parent)
 */
public record SpecialistRequest(
        String query,
        AgentContext context,
        String parentTraceId
) {
    public SpecialistRequest {
        Objects.requireNonNull(query, "query");
        Objects.requireNonNull(context, "context");
        if (query.isBlank()) {
            throw new IllegalArgumentException("SpecialistRequest.query cannot be blank");
        }
    }

    public static SpecialistRequest of(String query, AgentContext context) {
        return new SpecialistRequest(query, context, null);
    }
}
