package com.clenzy.service.agent.agui;

import com.clenzy.service.agent.AgentSseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Garantit qu'un echec (notamment rate-limit 429) ne laisse JAMAIS le chat muet :
 * le translator rend l'erreur comme un message assistant VISIBLE puis cloture le
 * run, au lieu d'un RUN_ERROR que CopilotKit n'affiche pas (bug "pourquoi tu me
 * reponds pas").
 */
class AgentSseEventToAgUiTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AgentSseEventToAgUi translator() {
        return new AgentSseEventToAgUi("thread-test", objectMapper);
    }

    private static String type(java.util.Map<String, Object> payload) {
        return String.valueOf(payload.get("type"));
    }

    @Test
    void error_isRenderedAsVisibleTextMessage_notSilentRunError() {
        List<AgUiEvent> out = translator().translate(
                AgentSseEvent.error("Orchestrator LLM error : nvidia API returned status 429"));

        List<String> types = out.stream().map(e -> type(e.payload())).toList();
        // Message texte visible (start → content → end) puis run clos en success.
        assertThat(types).containsSubsequence(
                "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END", "RUN_FINISHED");
        // Surtout PAS de RUN_ERROR muet.
        assertThat(types).doesNotContain("RUN_ERROR");
    }

    @Test
    void error_429_isHumanizedInFrench_noTechnicalLeak() {
        List<AgUiEvent> out = translator().translate(
                AgentSseEvent.error("nvidia API returned status 429 — Too Many Requests"));

        String content = out.stream()
                .filter(e -> "TEXT_MESSAGE_CONTENT".equals(type(e.payload())))
                .map(e -> String.valueOf(e.payload().get("delta")))
                .findFirst().orElse("");

        assertThat(content).contains("satur");            // message user lisible (accent-safe)
        assertThat(content).doesNotContain("429");        // pas de fuite technique
        assertThat(content).doesNotContainIgnoringCase("nvidia");
    }

    @Test
    void humanizeError_mapsKnownCategories() {
        assertThat(AgentSseEventToAgUi.humanizeError("status 429")).contains("satur");
        assertThat(AgentSseEventToAgUi.humanizeError("401 Unauthorized")).contains("API");
        assertThat(AgentSseEventToAgUi.humanizeError("read timed out")).contains("trop de temps");
        assertThat(AgentSseEventToAgUi.humanizeError("boom")).contains("erreur est survenue");
        assertThat(AgentSseEventToAgUi.humanizeError(null)).contains("erreur est survenue");
    }
}
