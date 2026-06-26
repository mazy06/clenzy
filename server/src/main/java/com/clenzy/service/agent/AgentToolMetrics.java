package com.clenzy.service.agent;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Metriques Micrometer d'observabilite des executions d'outils de l'assistant.
 *
 * <p>Expose un compteur exploitable dans Grafana :</p>
 * <pre>assistant.tool.executions{tool=&lt;nom&gt;, outcome=success|error}</pre>
 *
 * <p>Cardinalite maitrisee : on tague par {@code tool} (ensemble ferme et borne —
 * le {@link ToolRegistry} valide l'unicite au boot) et {@code outcome} (2 valeurs).
 * <b>Jamais</b> de tag par utilisateur ou par organisation (cardinalite illimitee).</p>
 *
 * <p>Convention alignee sur l'existant ({@code OrchestratorAgent},
 * {@code AbstractAgentSpecialist}) : noms dot-namespaced {@code assistant.*} et
 * compteurs crees inline via {@link MeterRegistry#counter(String, String...)}.</p>
 */
@Component
public class AgentToolMetrics {

    /** Nom du compteur d'executions d'outils. */
    public static final String TOOL_EXECUTIONS = "assistant.tool.executions";

    /**
     * Nom du compteur de tokens consommes (cout). N'est PAS une persistance —
     * c'est juste une exposition Grafana du meme usage deja persiste en base
     * ({@code ai_token_usage}). Tags : {@code provider}, {@code model}, {@code type}.
     */
    public static final String TOKENS = "assistant.tokens";

    private final MeterRegistry meterRegistry;

    public AgentToolMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
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
     * Expose la consommation de tokens d'un appel LLM assistant comme metrique
     * Grafana (cout). NE persiste PAS — la persistance reste {@code ai_token_usage}
     * via {@code AiTokenBudgetService.recordUsage}.
     *
     * <p>Cardinalite : {@code provider} (~4) x {@code model} (poignee) x {@code type}
     * (prompt/completion). Pas de tag par user/org.</p>
     *
     * @param provider         provider LLM (anthropic/openai/nvidia/...)
     * @param model            modele utilise
     * @param promptTokens     tokens d'entree (>=0)
     * @param completionTokens tokens de sortie (>=0)
     */
    public void recordTokens(String provider, String model, int promptTokens, int completionTokens) {
        String p = provider != null && !provider.isBlank() ? provider : "anthropic";
        String m = model != null && !model.isBlank() ? model : "unknown";
        if (promptTokens > 0) {
            meterRegistry.counter(TOKENS, "provider", p, "model", m, "type", "prompt")
                    .increment(promptTokens);
        }
        if (completionTokens > 0) {
            meterRegistry.counter(TOKENS, "provider", p, "model", m, "type", "completion")
                    .increment(completionTokens);
        }
    }
}
