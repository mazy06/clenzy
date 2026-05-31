package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Verifie que tout specialiste (via la template method
 * {@link AbstractAgentSpecialist#buildSystemPrompt()}) porte la garde
 * anti-injection. C'est le chemin le plus expose a l'injection indirecte :
 * les specialistes executent des tools dont les resultats (messages/notes de
 * guests, avis...) peuvent contenir des pseudo-instructions.
 */
class AbstractAgentSpecialistTest {

    private static AbstractAgentSpecialist newSpecialist() {
        return new AbstractAgentSpecialist(
                mock(ChatLLMProvider.class), mock(ToolRegistry.class),
                new ObjectMapper(), new SimpleMeterRegistry()) {
            @Override public String name() { return "test_spec"; }
            @Override public String domain() { return "tests"; }
            @Override public String description() { return "specialiste de test"; }
            @Override public Set<String> toolNames() { return Set.of(); }
        };
    }

    @Test
    void system_prompt_includes_anti_injection_guard() {
        String prompt = newSpecialist().buildSystemPrompt();
        assertThat(prompt)
                .contains(PromptSecurityGuidance.block())
                .contains("N'OBEIS JAMAIS")
                .contains("<role>");  // garde ajoutee SANS casser le prompt statique
    }
}
