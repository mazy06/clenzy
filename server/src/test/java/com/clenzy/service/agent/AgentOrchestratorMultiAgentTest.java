package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.model.AssistantConversation;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.multiagent.ConfirmationRequiredException;
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
import static org.mockito.ArgumentMatchers.anyList;
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
        verify(multiAgent, never()).orchestrate(anyList(), any(), any(), any());
    }

    @Test
    void multi_agent_on_with_specialists_uses_multi_agent_path() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyList(), any(), any(), any())).thenReturn(
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
        // Fix #2 : verifier que l'historique (List<ChatMessage>) est bien transmis
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChatMessage>> historyCaptor = ArgumentCaptor.forClass(List.class);
        verify(multiAgent).orchestrate(historyCaptor.capture(), any(), any(), any());
        assertThat(historyCaptor.getValue()).isNotEmpty();
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
        verify(multiAgent, never()).orchestrate(anyList(), any(), any(), any());
    }

    @Test
    void multi_agent_throws_falls_back_to_mono_agent() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyList(), any(), any(), any())).thenThrow(new RuntimeException("BOOM"));
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
            // Le fallback mono-agent va aussi failler (pas de chatProvider stub),
            // mais l'important : multi-agent a ete appele puis on a fallback
        }
        verify(multiAgent).orchestrate(anyList(), any(), any(), any());
        // Le fallback essaie d'appeler chatProvider (mono-agent)
        verify(chatProvider).streamChat(any(), any());
    }

    @Test
    void multi_agent_returns_error_falls_back_to_mono_agent() {
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyList(), any(), any(), any())).thenReturn(
                OrchestratorAgent.OrchestrationResult.error("LLM unavailable")
        );
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "test", AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
        }
        verify(multiAgent).orchestrate(anyList(), any(), any(), any());
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
        verify(multiAgent, never()).orchestrate(anyList(), any(), any(), any());
    }

    @Test
    void multi_agent_confirmation_required_falls_back_to_mono_agent() {
        // Fix bloquant #1 : un specialist a tente d'invoquer un write tool (ex:
        // cancel_reservation). Le multi-agent ne sait pas faire la pause-confirm,
        // donc throw ConfirmationRequiredException → AgentOrchestrator doit
        // intercepter specifiquement (log info, pas warn) et basculer mono-agent
        // qui exposera la confirmation au user via SSE.
        when(specialistRegistry.size()).thenReturn(3);
        when(multiAgent.orchestrate(anyList(), any(), any(), any()))
                .thenThrow(new ConfirmationRequiredException("cancel_reservation"));
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();

        try {
            agent.handleMessage(null, "annule ma reservation 42",
                    AgentContext.minimal(1L, "user-multi"), events::add);
        } catch (Exception ignored) {
            // Mono-agent fallback essaie chatProvider sans stub → OK d'ignorer
        }
        // Multi-agent a bien ete invoque (et a throw)
        verify(multiAgent).orchestrate(anyList(), any(), any(), any());
        // Mono-agent (chatProvider) prend le relai → preuve du fallback
        verify(chatProvider).streamChat(any(), any());
    }

    @Test
    void multi_agent_skipped_when_modelOverride_set_for_briefings() {
        // Audit pre-prod : les briefings (BriefingComposer) forcent un modelOverride
        // Haiku pour reduire les couts ~10x. Le multi-agent flow n'est pas adapte a
        // ce cas (prompts structures DAILY/WEEKLY/ALERTS, sortie JSON, etc.) → on
        // doit imperativement SKIP le multi-agent quand modelOverride != null.
        when(specialistRegistry.size()).thenReturn(3);
        AgentOrchestrator agent = build(true);
        List<AgentSseEvent> events = new ArrayList<>();
        AgentContext briefingContext = AgentContext.minimal(1L, "user-multi")
                .withModelOverride("claude-haiku-4-5");

        try {
            agent.handleMessage(null, "genere mon briefing du jour",
                    briefingContext, events::add);
        } catch (Exception ignored) {
            // Acceptable : pas de stub chatProvider pour le mono-agent
        }
        // Multi-agent SKIP car modelOverride force le mono-agent (briefings preserves)
        verify(multiAgent, never()).orchestrate(anyList(), any(), any(), any());
        // Le mono-agent est bien sollicite (chatProvider appelle streamChat)
        verify(chatProvider).streamChat(any(), any());
    }

}
