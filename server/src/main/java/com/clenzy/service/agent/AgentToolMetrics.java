package com.clenzy.service.agent;

import com.clenzy.service.ai.LlmPricingService;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Metriques Micrometer d'observabilite des executions d'outils et des appels
 * LLM de l'assistant (campagne multi-agent, ticket T-01).
 *
 * <p>Compteurs exposes dans Grafana :</p>
 * <pre>
 * assistant.tool.executions{tool, outcome=success|error}
 * assistant.tokens{provider, model, agent, type=prompt|completion|cached_prompt}
 * assistant.cost.usd{provider, model, agent}
 * assistant.pricing.unknown_model{model}
 * </pre>
 *
 * <p>Cardinalite maitrisee : {@code tool} (ensemble ferme, valide au boot par le
 * {@link ToolRegistry}), {@code provider} (~4), {@code model} (poignee),
 * {@code agent} (ensemble ferme : {@link #AGENT_MONO}, {@link #AGENT_MULTI} —
 * l'attribution par specialist arrivera avec le ledger par step, ticket T-05),
 * {@code outcome}/{@code type} (2-3 valeurs). <b>Jamais</b> de tag par
 * utilisateur ou par organisation (cardinalite illimitee).</p>
 *
 * <p>Semantique cout : les {@code promptTokens} recus sont les tokens
 * <b>factures</b> (deja cache-ajustes par les providers — voir
 * {@code ChatEvent.billedPromptTokens}) → {@code assistant.cost.usd} reflete le
 * cout provider reel. Les {@code cached_prompt} tokens (lecture cache) sont
 * comptes a part pour suivre l'efficacite du prompt caching (ratio cache =
 * cached_prompt / (prompt + cached_prompt) en premiere approximation).</p>
 */
@Component
public class AgentToolMetrics {

    /** Nom du compteur d'executions d'outils. */
    public static final String TOOL_EXECUTIONS = "assistant.tool.executions";

    /**
     * Nom du compteur de tokens consommes. N'est PAS une persistance —
     * c'est juste une exposition Grafana du meme usage deja persiste en base
     * ({@code ai_token_usage}). Tags : {@code provider}, {@code model},
     * {@code agent}, {@code type}.
     */
    public static final String TOKENS = "assistant.tokens";

    /** Nom du compteur de cout USD (tokens factures × grille LlmPricingService). */
    public static final String COST_USD = "assistant.cost.usd";

    /** Compteur d'appels dont le modele n'a pas de tarif (cout compte a zero → alerte). */
    public static final String UNKNOWN_MODEL = "assistant.pricing.unknown_model";

    /** Valeur du tag {@code agent} pour la boucle mono-agent. */
    public static final String AGENT_MONO = "mono";

    /** Valeur du tag {@code agent} pour un tour multi-agent (orchestrateur + specialists agreges). */
    public static final String AGENT_MULTI = "multi_agent";

    /** Valeur du tag {@code agent} pour l'appel de classification du routeur d'intention (T-02). */
    public static final String AGENT_ROUTER = "router";

    private final MeterRegistry meterRegistry;
    private final LlmPricingService pricingService;

    public AgentToolMetrics(MeterRegistry meterRegistry, LlmPricingService pricingService) {
        this.meterRegistry = meterRegistry;
        this.pricingService = pricingService;
    }

    /**
     * Incremente le compteur d'executions pour un outil donne.
     *
     * @param toolName nom de l'outil (tag {@code tool})
     * @param success  true → {@code outcome=success}, false → {@code outcome=error}
     */
    public void recordExecution(String toolName, boolean success) {
        meterRegistry.counter(TOOL_EXECUTIONS,
                "tool", toolName != null ? toolName : "unknown",
                "outcome", success ? "success" : "error"
        ).increment();
    }

    /**
     * Expose la consommation d'un appel LLM assistant : tokens (prompt facture /
     * completion / cache lu), cout USD, et detection de modele sans tarif.
     * NE persiste PAS — la persistance reste {@code ai_token_usage} via
     * {@code AiTokenBudgetService.recordUsage}.
     *
     * @param provider           provider LLM (anthropic/openai/nvidia/...)
     * @param model              modele utilise
     * @param agent              origine de l'appel — {@link #AGENT_MONO} ou {@link #AGENT_MULTI}
     * @param promptTokens       tokens d'entree FACTURES (cache-ajustes provider, >=0)
     * @param completionTokens   tokens de sortie (>=0)
     * @param cachedPromptTokens sous-ensemble de l'entree servi depuis le cache (>=0)
     */
    public void recordLlmUsage(String provider, String model, String agent,
                               int promptTokens, int completionTokens, int cachedPromptTokens) {
        String p = provider != null && !provider.isBlank() ? provider : "anthropic";
        String m = model != null && !model.isBlank() ? model : "unknown";
        String a = agent != null && !agent.isBlank() ? agent : "unknown";

        if (promptTokens > 0) {
            meterRegistry.counter(TOKENS, "provider", p, "model", m, "agent", a, "type", "prompt")
                    .increment(promptTokens);
        }
        if (completionTokens > 0) {
            meterRegistry.counter(TOKENS, "provider", p, "model", m, "agent", a, "type", "completion")
                    .increment(completionTokens);
        }
        if (cachedPromptTokens > 0) {
            meterRegistry.counter(TOKENS, "provider", p, "model", m, "agent", a, "type", "cached_prompt")
                    .increment(cachedPromptTokens);
        }

        if (promptTokens > 0 || completionTokens > 0) {
            if (pricingService.isKnownModel(m)) {
                BigDecimal cost = pricingService.computeCost(m, promptTokens, completionTokens);
                if (cost.signum() > 0) {
                    meterRegistry.counter(COST_USD, "provider", p, "model", m, "agent", a)
                            .increment(cost.doubleValue());
                }
            } else {
                // Cout compte a zero faute de tarif : compte a part pour alerter
                // (Grafana : rate(assistant.pricing.unknown_model) > 0 → MAJ grille).
                meterRegistry.counter(UNKNOWN_MODEL, "model", m).increment();
            }
        }
    }
}
