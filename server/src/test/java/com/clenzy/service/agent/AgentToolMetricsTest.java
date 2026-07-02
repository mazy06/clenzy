package com.clenzy.service.agent;

import com.clenzy.service.ai.LlmPricingService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests des metriques Micrometer d'observabilite de l'assistant :
 * executions d'outils (tool x outcome), tokens (provider x model x agent x type),
 * cout USD et detection de modele sans tarif (T-01).
 */
class AgentToolMetricsTest {

    private SimpleMeterRegistry registry;
    private AgentToolMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new AgentToolMetrics(registry, new LlmPricingService());
    }

    private double execCount(String tool, String outcome) {
        var c = registry.find(AgentToolMetrics.TOOL_EXECUTIONS)
                .tag("tool", tool).tag("outcome", outcome).counter();
        return c == null ? 0d : c.count();
    }

    private double tokenCount(String provider, String model, String agent, String type) {
        var c = registry.find(AgentToolMetrics.TOKENS)
                .tag("provider", provider).tag("model", model)
                .tag("agent", agent).tag("type", type).counter();
        return c == null ? 0d : c.count();
    }

    private double costUsd(String provider, String model, String agent) {
        var c = registry.find(AgentToolMetrics.COST_USD)
                .tag("provider", provider).tag("model", model).tag("agent", agent).counter();
        return c == null ? 0d : c.count();
    }

    private double unknownModelCount(String model) {
        var c = registry.find(AgentToolMetrics.UNKNOWN_MODEL).tag("model", model).counter();
        return c == null ? 0d : c.count();
    }

    @Nested
    @DisplayName("Tool execution counter")
    class ToolExecutions {

        @Test
        void success_incrementsSuccessOutcome() {
            metrics.recordExecution("create_reservation", true);

            assertThat(execCount("create_reservation", "success")).isEqualTo(1d);
            assertThat(execCount("create_reservation", "error")).isZero();
        }

        @Test
        void error_incrementsErrorOutcome() {
            metrics.recordExecution("set_rate_override", false);

            assertThat(execCount("set_rate_override", "error")).isEqualTo(1d);
        }

        @Test
        void repeatedCalls_accumulate() {
            metrics.recordExecution("list_reservations", true);
            metrics.recordExecution("list_reservations", true);
            metrics.recordExecution("list_reservations", false);

            assertThat(execCount("list_reservations", "success")).isEqualTo(2d);
            assertThat(execCount("list_reservations", "error")).isEqualTo(1d);
        }

        @Test
        void nullToolName_taggedUnknown() {
            metrics.recordExecution(null, true);

            assertThat(execCount("unknown", "success")).isEqualTo(1d);
        }
    }

    @Nested
    @DisplayName("Token / cost counter")
    class Tokens {

        @Test
        void recordsPromptCompletionAndCacheSeparately_withAgentTag() {
            metrics.recordLlmUsage("anthropic", "claude-sonnet-4", AgentToolMetrics.AGENT_MONO,
                    1000, 250, 400);

            assertThat(tokenCount("anthropic", "claude-sonnet-4", "mono", "prompt")).isEqualTo(1000d);
            assertThat(tokenCount("anthropic", "claude-sonnet-4", "mono", "completion")).isEqualTo(250d);
            assertThat(tokenCount("anthropic", "claude-sonnet-4", "mono", "cached_prompt")).isEqualTo(400d);
        }

        @Test
        void agentTag_separatesMonoFromMultiAgent() {
            metrics.recordLlmUsage("anthropic", "claude-sonnet-4", AgentToolMetrics.AGENT_MONO, 100, 10, 0);
            metrics.recordLlmUsage("anthropic", "claude-sonnet-4", AgentToolMetrics.AGENT_MULTI, 900, 90, 0);

            assertThat(tokenCount("anthropic", "claude-sonnet-4", "mono", "prompt")).isEqualTo(100d);
            assertThat(tokenCount("anthropic", "claude-sonnet-4", "multi_agent", "prompt")).isEqualTo(900d);
        }

        @Test
        void zeroTokens_notRecorded() {
            metrics.recordLlmUsage("openai", "gpt-4", AgentToolMetrics.AGENT_MONO, 0, 0, 0);

            assertThat(tokenCount("openai", "gpt-4", "mono", "prompt")).isZero();
            assertThat(tokenCount("openai", "gpt-4", "mono", "completion")).isZero();
            assertThat(costUsd("openai", "gpt-4", "mono")).isZero();
        }

        @Test
        void nullProviderModelAndAgent_defaulted() {
            metrics.recordLlmUsage(null, null, null, 5, 3, 0);

            assertThat(tokenCount("anthropic", "unknown", "unknown", "prompt")).isEqualTo(5d);
            assertThat(tokenCount("anthropic", "unknown", "unknown", "completion")).isEqualTo(3d);
        }
    }

    @Nested
    @DisplayName("Cost USD counter")
    class Cost {

        @Test
        void knownModel_incrementsCostFromPricingGrid() {
            // claude-sonnet-4 : 3 $/Mtok input, 15 $/Mtok output
            // 1000 prompt → 0.003 ; 250 completion → 0.00375 ; total 0.00675
            metrics.recordLlmUsage("anthropic", "claude-sonnet-4-20250514",
                    AgentToolMetrics.AGENT_MONO, 1000, 250, 0);

            assertThat(costUsd("anthropic", "claude-sonnet-4-20250514", "mono"))
                    .isCloseTo(0.00675d, within(1e-9));
            assertThat(unknownModelCount("claude-sonnet-4-20250514")).isZero();
        }

        @Test
        void costAccumulatesAcrossCalls() {
            metrics.recordLlmUsage("anthropic", "claude-haiku-4-5", AgentToolMetrics.AGENT_MONO, 1000, 0, 0);
            metrics.recordLlmUsage("anthropic", "claude-haiku-4-5", AgentToolMetrics.AGENT_MONO, 1000, 0, 0);

            // haiku : 0.80 $/Mtok input → 2 × 0.0008
            assertThat(costUsd("anthropic", "claude-haiku-4-5", "mono"))
                    .isCloseTo(0.0016d, within(1e-9));
        }

        @Test
        void unknownModel_zeroCostButCountedAsUnknown() {
            metrics.recordLlmUsage("openai", "totally-unknown-model",
                    AgentToolMetrics.AGENT_MULTI, 500, 100, 0);

            assertThat(costUsd("openai", "totally-unknown-model", "multi_agent")).isZero();
            assertThat(unknownModelCount("totally-unknown-model")).isEqualTo(1d);
        }
    }
}
