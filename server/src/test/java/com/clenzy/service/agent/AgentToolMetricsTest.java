package com.clenzy.service.agent;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests des metriques Micrometer d'observabilite de l'assistant :
 * compteur d'executions d'outils (tool x outcome) et compteur de tokens (provider x model x type).
 */
class AgentToolMetricsTest {

    private SimpleMeterRegistry registry;
    private AgentToolMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new AgentToolMetrics(registry);
    }

    private double execCount(String tool, String outcome) {
        var c = registry.find(AgentToolMetrics.TOOL_EXECUTIONS)
                .tag("tool", tool).tag("outcome", outcome).counter();
        return c == null ? 0d : c.count();
    }

    private double tokenCount(String provider, String model, String type) {
        var c = registry.find(AgentToolMetrics.TOKENS)
                .tag("provider", provider).tag("model", model).tag("type", type).counter();
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
        void recordsPromptAndCompletionSeparately() {
            metrics.recordTokens("anthropic", "claude-sonnet-4", 1000, 250);

            assertThat(tokenCount("anthropic", "claude-sonnet-4", "prompt")).isEqualTo(1000d);
            assertThat(tokenCount("anthropic", "claude-sonnet-4", "completion")).isEqualTo(250d);
        }

        @Test
        void zeroTokens_notRecorded() {
            metrics.recordTokens("openai", "gpt-4", 0, 0);

            assertThat(tokenCount("openai", "gpt-4", "prompt")).isZero();
            assertThat(tokenCount("openai", "gpt-4", "completion")).isZero();
        }

        @Test
        void nullProviderAndModel_defaulted() {
            metrics.recordTokens(null, null, 5, 3);

            assertThat(tokenCount("anthropic", "unknown", "prompt")).isEqualTo(5d);
            assertThat(tokenCount("anthropic", "unknown", "completion")).isEqualTo(3d);
        }
    }
}
