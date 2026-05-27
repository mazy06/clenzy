package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.model.AssistantConversation;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.multiagent.OrchestratorAgent;
import com.clenzy.service.agent.multiagent.SpecialistRegistry;
import com.clenzy.service.agent.multiagent.ToolInvocationSnapshot;
import com.clenzy.service.agent.prompt.PromptBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests integration du dispatch multi-agent vs mono-agent dans AgentOrchestrator.
 *
 * <p>Couvre les 4 cas clés :</p>
 * <ol>
 *   <li>Multi-agent OFF → mono-agent (legacy path, runToolLoop)</li>
 *   <li>Multi-agent ON + specialists present + sans attachments → multi-agent path</li>
 *   <li>Multi-agent ON + specialists vides → fallback mono-agent</li>
 *   <li>Multi-agent ON + throws → fallback mono-agent</li>
 *   <li>Multi-agent ON + avec attachments → fallback mono-agent (vision pas supportee)</li>
 * </ol>
 */
class AgentOrchestratorMultiAgentTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private OrgAiApiKeyRepository keyRepo;
    private AssistantMemoryService memoryService;
    private KbSearchService kbSearchService;
    private OrchestratorAgent multiAgent;
    private SpecialistRegistry specialistRegistry;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        toolRegistry = mock(ToolRegistry.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        keyRepo = mock(OrgAiApiKeyRepository.class);
        memoryService = mock(AssistantMemoryService.class);
        kbSearchService = mock(KbSearchService.class);
        multiAgent = mock(OrchestratorAgent.class);
        specialistRegistry = mock(SpecialistRegistry.class);

        // Conversation creee par defaut
        AssistantConversation conv = new AssistantConversation(1L, "user-multi");
        conv.setId(100L);
        when(convRepo.save(any())).thenReturn(conv);
        when(convRepo.findByIdAndUser(anyLong(), anyString())).thenReturn(Optional.of(conv));

        when(toolRegistry.listDescriptors()).thenReturn(List.of());
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString())).thenReturn(Optional.empty());
        when(memoryService.listForUser(anyString(), anyInt())).thenReturn(List.of());
        when(memoryService.listMostRelevant(anyLong(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of());
        when(kbSearchService.search(anyString(), any(), anyInt())).thenReturn(List.of());
        // Renvoyer au moins le user message dans l'historique (sinon
        // ChatRequest construction throw "messages cannot be empty")
        com.clenzy.model.AssistantMessage userMsg = com.clenzy.model.AssistantMessage.user(
                100L, 1L, "test");
        when(msgRepo.findByConversation(anyLong())).thenReturn(List.of(userMsg));
    }

    private AgentOrchestrator build(boolean multiAgentEnabled) {
        return new AgentOrchestrator(
                chatProvider, toolRegistry, convRepo, msgRepo, new ObjectMapper(),
                keyRepo, new AiProperties(), new PendingToolStore(),
                memoryService, mock(PhotoStorageService.class), kbSearchService,
                mock(PromptBuilder.class),
                multiAgent, specialistRegistry,
                false, multiAgentEnabled
        );
    }

    @Test
    void multi_agent_off_skips_orchestrator_uses_mono_agent() {
        AgentOrchestrator agent = build(false);
        List<AgentSseEvent> events = new ArrayList<>();

        // mono-agent va appeler chatProvider qui n'est pas stubbé → l'orchestrator
        // emettra une erreur. On verifie juste que le multi-agent N'EST PAS appele.
        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
            // Acceptable : pas de stub chatProvider pour le mono-agent
        }
        verify(multiAgent, never()).orchestrate(anyString(), any());
    }

    @Test
    void multi_agent_on_with_specialists_uses_multi_agent_path() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyString(), any())).thenReturn(
                OrchestratorAgent.OrchestrationResult.success(
                        "Tu as 5 proprietes.",
                        List.of("data_analyst → OK"),
                        List.of(new ToolInvocationSnapshot("list_properties",
                                "{\"items\":[...]}", "list", false)),
                        100, 30, 1
                )
        );
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        Long convId = agent.handleMessage(null, "liste mes proprietes",
                AgentContext.minimal(1L, "user-multi"), events::add);

        assertThat(convId).isEqualTo(100L);
        verify(multiAgent).orchestrate(eq("liste mes proprietes"), any());
        // chatProvider doit NE PAS etre appele (mono-agent skip)
        verify(chatProvider, never()).streamChat(any(), any());
        // Events SSE : conversation_created + tool_call_executed + text_delta + done
        assertThat(events).hasSizeGreaterThanOrEqualTo(3);
    }

    @Test
    void multi_agent_on_but_no_specialists_falls_back_to_mono_agent() {
        when(specialistRegistry.size()).thenReturn(0);  // vide
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
            // Acceptable
        }
        // Multi-agent SKIP car size==0
        verify(multiAgent, never()).orchestrate(anyString(), any());
    }

    @Test
    void multi_agent_throws_falls_back_to_mono_agent() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyString(), any())).thenThrow(new RuntimeException("BOOM"));
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
            // Le fallback mono-agent va aussi failler (pas de chatProvider stub),
            // mais l'important : multi-agent a ete appele puis on a fallback
        }
        verify(multiAgent).orchestrate(anyString(), any());
        // Le fallback essaie d'appeler chatProvider (mono-agent)
        verify(chatProvider).streamChat(any(), any());
    }

    @Test
    void multi_agent_returns_error_falls_back_to_mono_agent() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyString(), any())).thenReturn(
                OrchestratorAgent.OrchestrationResult.error("LLM unavailable")
        );
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
        }
        verify(multiAgent).orchestrate(anyString(), any());
        verify(chatProvider).streamChat(any(), any());
    }

    @Test
    void multi_agent_with_attachments_falls_back_to_mono_agent_vision() {
        when(specialistRegistry.size()).thenReturn(3);
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();
        AttachmentRef attachment = new AttachmentRef("storage-key-1", "image/jpeg",
                "/api/assistant/attachments/storage-key-1", "photo.jpg");

        try {
            agent.handleMessage(null, "decris cette photo",
                    List.of(attachment),
                    AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
        }
        // Multi-agent skip car vision pas supportee
        verify(multiAgent, never()).orchestrate(anyString(), any());
    }

    // Helper : eq matcher pour String avec verifications precises
    private static String eq(String expected) {
        return org.mockito.ArgumentMatchers.eq(expected);
    }
}
