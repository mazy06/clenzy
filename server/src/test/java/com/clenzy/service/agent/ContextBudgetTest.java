package com.clenzy.service.agent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Vérifie la troncature des résultats d'outils envoyés au LLM (lever #2). */
class ContextBudgetTest {

    @Test
    void smallResult_isReturnedUnchanged() {
        String small = "{\"ok\":true}";
        assertThat(ContextBudget.capToolResult(small)).isEqualTo(small);
    }

    @Test
    void nullResult_becomesEmptyString() {
        assertThat(ContextBudget.capToolResult(null)).isEmpty();
    }

    @Test
    void oversizedResult_isTruncatedWithMarker() {
        String big = "x".repeat(ContextBudget.MAX_TOOL_RESULT_CHARS + 5000);

        String capped = ContextBudget.capToolResult(big);

        assertThat(capped.length()).isLessThan(big.length());
        assertThat(capped).startsWith("x".repeat(ContextBudget.MAX_TOOL_RESULT_CHARS));
        assertThat(capped).contains("tronqué");
        assertThat(capped).contains(String.valueOf(big.length()));
    }
}
