package com.clenzy.service.agent.multiagent;

import com.clenzy.service.agent.AgentContext;

import java.util.Objects;

/**
 * Requête immutable envoyée à un {@link AgentSpecialist}.
 *
 * @param query              question/tache deleguee par l'orchestrator (jamais null/blank)
 * @param context            identite + tenant + UI hints (jamais null)
 * @param orchestrationCtx   memoire + RAG pre-charges par AgentOrchestrator.
 *                           Jamais null (utiliser {@link OrchestrationContext#empty()}).
 * @param apiKey             cle BYOK Anthropic resolue par AgentOrchestrator.
 *                           {@code null} = utiliser la cle plateforme (degradation
 *                           gracieuse quand l'org n'a pas de BYOK).
 *                           Cette cle ne DOIT JAMAIS etre loggee.
 * @param parentTraceId      identifiant de trace de l'orchestrator (observabilite,
 *                           permet de regrouper les LLM calls dans Datadog/Sentry)
 *                           null OK (pas de tracing parent)
 */
public record SpecialistRequest(
        String query,
        AgentContext context,
        OrchestrationContext orchestrationCtx,
        String apiKey,
        String parentTraceId
) {
    public SpecialistRequest {
        Objects.requireNonNull(query, "query");
        Objects.requireNonNull(context, "context");
        if (query.isBlank()) {
            throw new IllegalArgumentException("SpecialistRequest.query cannot be blank");
        }
        if (orchestrationCtx == null) {
            orchestrationCtx = OrchestrationContext.empty();
        }
    }

    /** Helper sans orchestrationCtx ni apiKey ni parentTraceId (defaults vides). */
    public static SpecialistRequest of(String query, AgentContext context) {
        return new SpecialistRequest(query, context, OrchestrationContext.empty(), null, null);
    }

    /** Helper avec orchestrationCtx (sans apiKey ni parentTraceId). */
    public static SpecialistRequest of(String query, AgentContext context,
                                         OrchestrationContext orchestrationCtx) {
        return new SpecialistRequest(query, context, orchestrationCtx, null, null);
    }

    /** Helper avec orchestrationCtx + apiKey (cas standard via AgentOrchestrator). */
    public static SpecialistRequest of(String query, AgentContext context,
                                         OrchestrationContext orchestrationCtx,
                                         String apiKey) {
        return new SpecialistRequest(query, context, orchestrationCtx, apiKey, null);
    }
}
