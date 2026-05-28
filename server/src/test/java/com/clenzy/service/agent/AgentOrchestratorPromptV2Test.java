package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.PromptBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests dedies au cross-path v1/v2 du AgentOrchestrator.buildSystemPrompt.
 *
 * <p>Couvre les 3 scenarios cles que les autres tests ne touchent pas :</p>
 * <ol>
 *   <li>v2 actif + builder retourne un prompt valide → output = prompt v2</li>
 *   <li>v2 actif + builder retourne blank → fallback v1 (DEFAULT_SYSTEM_PROMPT)</li>
 *   <li>v2 actif + builder throw exception → fallback v1 (graceful degradation)</li>
 * </ol>
 *
 * <p>Utilise la reflection pour exposer la methode {@code buildSystemPrompt}
 * package-private — accepte ici car les autres alternatives (rendre la
 * methode public ou rajouter un endpoint test-only) seraient pire pour la
 * surface API.</p>
 */
class AgentOrchestratorPromptV2Test {

    private PromptBuilder promptBuilder;
    private AssistantMemoryService memoryService;
    private KbSearchService kbSearchService;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        promptBuilder = mock(PromptBuilder.class);
        memoryService = mock(AssistantMemoryService.class);
        kbSearchService = mock(KbSearchService.class);
        ctx = AgentContext.minimal(1L, "user-v2");

        // Memory + RAG vides par defaut (les tests focus sur le composer)
        when(memoryService.listForUser(anyString(), anyInt())).thenReturn(List.of());
        when(memoryService.listMostRelevant(anyLong(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of());
        when(kbSearchService.search(anyString(), any(), anyInt())).thenReturn(List.of());
    }

    @Test
    void v2_enabled_and_builder_returns_valid_prompt_uses_v2_output() throws Exception {
        String v2Output = "<role>SHINY-V2-PROMPT</role>";
        when(promptBuilder.buildChatPrompt(any(), anyString(), any(), any()))
                .thenReturn(v2Output);
        AgentOrchestrator orchestrator = buildOrchestrator(true);

        String result = invokeBuildSystemPrompt(orchestrator, ctx, "Hello");
        assertThat(result).isEqualTo(v2Output);
    }

    @Test
    void v2_enabled_but_builder_returns_blank_falls_back_to_v1() throws Exception {
        when(promptBuilder.buildChatPrompt(any(), ArgumentMatchers.nullable(String.class),
                any(), any())).thenReturn("   \n  ");
        AgentOrchestrator orchestrator = buildOrchestrator(true);

        String result = invokeBuildSystemPrompt(orchestrator, ctx, "Hello");
        // Fallback v1 : contient le DEFAULT_SYSTEM_PROMPT (marqueur facile a verifier)
        assertThat(result).contains("assistant strategique Clenzy");
    }

    @Test
    void v2_enabled_but_builder_returns_null_falls_back_to_v1() throws Exception {
        when(promptBuilder.buildChatPrompt(any(), ArgumentMatchers.nullable(String.class),
                any(), any())).thenReturn(null);
        AgentOrchestrator orchestrator = buildOrchestrator(true);

        String result = invokeBuildSystemPrompt(orchestrator, ctx, "Hello");
        assertThat(result).contains("assistant strategique Clenzy");
    }

    @Test
    void v2_enabled_but_builder_throws_falls_back_to_v1_gracefully() throws Exception {
        when(promptBuilder.buildChatPrompt(any(), ArgumentMatchers.nullable(String.class),
                any(), any())).thenThrow(new RuntimeException("BOOM"));
        AgentOrchestrator orchestrator = buildOrchestrator(true);

        String result = invokeBuildSystemPrompt(orchestrator, ctx, "Hello");
        assertThat(result).contains("assistant strategique Clenzy");
    }

    @Test
    void v2_disabled_skips_builder_entirely_uses_v1() throws Exception {
        // Avec v2 OFF, le builder n'est meme pas appele (pas de stubbing nécessaire).
        AgentOrchestrator orchestrator = buildOrchestrator(false);

        String result = invokeBuildSystemPrompt(orchestrator, ctx, "Hello");
        assertThat(result).contains("assistant strategique Clenzy");
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private AgentOrchestrator buildOrchestrator(boolean v2Enabled) {
        return new AgentOrchestrator(
                mock(ChatLLMProvider.class),
                mock(ToolRegistry.class),
                mock(AssistantConversationRepository.class),
                mock(AssistantMessageRepository.class),
                new ObjectMapper(),
                mock(OrgAiApiKeyRepository.class),
                new AiProperties(),
                new PendingToolStore(),
                memoryService,
                mock(PhotoStorageService.class),
                kbSearchService,
                promptBuilder,
                mock(com.clenzy.service.agent.multiagent.OrchestratorAgent.class),
                mock(com.clenzy.service.agent.multiagent.SpecialistRegistry.class),
                mock(com.clenzy.service.AiTokenBudgetService.class),
                v2Enabled,
                false  // multi-agent off : on teste le prompt path uniquement
        );
    }

    /** Reflection pour exposer la methode package-private. */
    private String invokeBuildSystemPrompt(AgentOrchestrator orchestrator,
                                            AgentContext context,
                                            String userMessage) throws Exception {
        Method m = AgentOrchestrator.class.getDeclaredMethod(
                "buildSystemPrompt", AgentContext.class, String.class);
        m.setAccessible(true);
        return (String) m.invoke(orchestrator, context, userMessage);
    }
}
