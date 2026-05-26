package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMemory;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.AssistantMemoryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AgentOrchestratorTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private OrgAiApiKeyRepository keyRepo;
    private AssistantMemoryService memoryService;
    private com.clenzy.service.agent.kb.KbSearchService kbSearchService;
    private AgentOrchestrator orchestrator;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        toolRegistry = mock(ToolRegistry.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        keyRepo = mock(OrgAiApiKeyRepository.class);
        memoryService = mock(AssistantMemoryService.class);
        kbSearchService = mock(com.clenzy.service.agent.kb.KbSearchService.class);
        om = new ObjectMapper();
        orchestrator = new AgentOrchestrator(chatProvider, toolRegistry,
                convRepo, msgRepo, om, keyRepo, new AiProperties(), new PendingToolStore(),
                memoryService, mock(com.clenzy.service.PhotoStorageService.class),
                kbSearchService);
        ctx = AgentContext.minimal(1L, "user-123");

        when(toolRegistry.listDescriptors()).thenReturn(List.of());
        // Pas de cle BYOK → plateforme
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString())).thenReturn(Optional.empty());
        // Memoire vide par defaut (les tests memoire surchargent)
        when(memoryService.listForUser(anyString(), anyInt())).thenReturn(List.of());
        // RAG : aucun hit par defaut
        when(kbSearchService.search(anyString(), any(), anyInt())).thenReturn(List.of());
    }

    @Test
    void noToolCalls_persistsUserAndAssistant_emitsDeltasAndDone() {
        // Conv neuve : repo retourne ce qu'on lui save
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(42L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(42L)).thenReturn(List.of(
                AssistantMessage.user(42L, 1L, "Bonjour")
        ));

        // LLM repond avec du texte direct, pas de tools
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.TextDelta("Salut "));
            consumer.accept(new ChatEvent.TextDelta("toi"));
            consumer.accept(new ChatEvent.Done(20, 10, "claude-sonnet-4", "end_turn", "Salut toi"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        Long convId = orchestrator.handleMessage(null, "Bonjour", ctx, events::add);

        assertEquals(42L, convId);

        // 1 conversation_created + 2 text_delta + 1 done
        assertEquals("conversation_created", events.get(0).type());
        assertEquals(42L, events.get(0).conversationId());
        assertEquals("text_delta", events.get(1).type());
        assertEquals("Salut ", events.get(1).delta());
        assertEquals("text_delta", events.get(2).type());
        assertEquals("toi", events.get(2).delta());
        assertEquals("done", events.get(3).type());
        assertEquals("end_turn", events.get(3).finishReason());

        // Persistance : 1 user + 1 assistant
        verify(msgRepo, atLeast(2)).save(any(AssistantMessage.class));
    }

    @Test
    void toolCallLoop_executesTools_thenSendsResultsBackToLLM() {
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(7L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(7L)).thenReturn(List.of(
                AssistantMessage.user(7L, 1L, "Combien de proprietes ?")
        ));

        // Tool register
        ToolHandler tool = mock(ToolHandler.class);
        when(tool.name()).thenReturn("list_properties");
        when(tool.execute(any(), any())).thenReturn(ToolResult.success(
                "{\"items\":[{\"id\":1,\"name\":\"Loft\"}],\"count\":1}", "list"));
        when(toolRegistry.find("list_properties")).thenReturn(Optional.of(tool));

        // 1er appel : LLM emet un tool_call
        // 2e appel : LLM repond en texte avec la donnee
        int[] callCount = {0};
        doAnswer(inv -> {
            callCount[0]++;
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount[0] == 1) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_1", "list_properties", "{}")
                )));
                consumer.accept(new ChatEvent.Done(30, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Tu as 1 propriete."));
                consumer.accept(new ChatEvent.Done(50, 10, "claude", "end_turn", "Tu as 1 propriete."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "Combien de proprietes ?", ctx, events::add);

        // Verify tool exec
        verify(tool, times(1)).execute(any(), any());

        // Verify 2 LLM calls
        verify(chatProvider, times(2)).streamChat(any(ChatRequest.class), any());

        // Events : conv_created, tool_call_executed, text_delta, done
        assertTrue(events.stream().anyMatch(e -> "tool_call_executed".equals(e.type())));
        AgentSseEvent toolEvent = events.stream()
                .filter(e -> "tool_call_executed".equals(e.type())).findFirst().orElseThrow();
        assertEquals("list_properties", toolEvent.toolName());
        assertFalse(toolEvent.toolError());

        assertTrue(events.stream().anyMatch(e -> "text_delta".equals(e.type())));
        assertTrue(events.stream().anyMatch(e -> "done".equals(e.type())));
    }

    @Test
    void existingConversation_ownershipMismatch_throws() {
        when(convRepo.findByIdAndUser(99L, "user-123")).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> orchestrator.handleMessage(99L, "hi", ctx, e -> {}));
        assertTrue(ex.getMessage().contains("99"));
    }

    @Test
    void unknownTool_returnsErrorResultToLLM() {
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(3L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(3L)).thenReturn(List.of(
                AssistantMessage.user(3L, 1L, "hi")
        ));
        when(toolRegistry.find("ghost_tool")).thenReturn(Optional.empty());

        int[] count = {0};
        doAnswer(inv -> {
            count[0]++;
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (count[0] == 1) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("t1", "ghost_tool", "{}")
                )));
                consumer.accept(new ChatEvent.Done(10, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Pas dispo"));
                consumer.accept(new ChatEvent.Done(15, 5, "claude", "end_turn", "Pas dispo"));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "hi", ctx, events::add);

        AgentSseEvent toolEvent = events.stream()
                .filter(e -> "tool_call_executed".equals(e.type())).findFirst().orElseThrow();
        assertTrue(toolEvent.toolError(), "Unknown tool => is_error true");
        assertEquals("ghost_tool", toolEvent.toolName());
    }

    @Test
    void infiniteToolLoop_boundedByMaxIterations() {
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(1L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(1L)).thenReturn(List.of(
                AssistantMessage.user(1L, 1L, "loop")));

        ToolHandler tool = mock(ToolHandler.class);
        when(tool.name()).thenReturn("looper");
        when(tool.execute(any(), any())).thenReturn(ToolResult.success("{}"));
        when(toolRegistry.find("looper")).thenReturn(Optional.of(tool));

        // LLM emet UN tool_call a CHAQUE appel — boucle infinie
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("t", "looper", "{}"))));
            consumer.accept(new ChatEvent.Done(10, 5, "claude", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "loop", ctx, events::add);

        // Doit s'arreter sur erreur "Trop d'iterations"
        AgentSseEvent error = events.stream()
                .filter(e -> "error".equals(e.type())).findFirst().orElseThrow();
        assertTrue(error.error().contains("Trop d'iterations"));

        // Verify max 5 iterations
        verify(chatProvider, times(5)).streamChat(any(ChatRequest.class), any());
    }

    @Test
    void llmError_propagatedAsSseError() {
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(8L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(8L)).thenReturn(List.of(
                AssistantMessage.user(8L, 1L, "hi")));

        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.Error("API overloaded", null));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        List<AgentSseEvent> events = new ArrayList<>();
        orchestrator.handleMessage(null, "hi", ctx, events::add);

        AgentSseEvent error = events.stream()
                .filter(e -> "error".equals(e.type())).findFirst().orElseThrow();
        assertTrue(error.error().contains("API overloaded"));
    }

    @Test
    void blankMessage_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> orchestrator.handleMessage(null, "", ctx, e -> {}));
        assertThrows(IllegalArgumentException.class,
                () -> orchestrator.handleMessage(null, "  ", ctx, e -> {}));
        assertThrows(IllegalArgumentException.class,
                () -> orchestrator.handleMessage(null, null, ctx, e -> {}));
    }

    @Test
    void buildSystemPrompt_withNoMemory_returnsDefaultUnchanged() {
        when(memoryService.listForUser("user-123", 30)).thenReturn(List.of());

        String prompt = orchestrator.buildSystemPrompt(ctx);

        assertFalse(prompt.startsWith("── Memoire utilisateur ──"),
                "Sans memoire, pas de section memoire");
        assertTrue(prompt.contains("Tu es l'assistant strategique Clenzy"),
                "Le prompt par defaut doit etre present");
    }

    @Test
    void buildSystemPrompt_withMemory_prependsGroupedSection() {
        AssistantMemory pref = new AssistantMemory(1L, "user-123",
                "briefing_time", "08:00", AssistantMemory.Scope.PREFERENCE);
        AssistantMemory fact = new AssistantMemory(1L, "user-123",
                "owner_42_difficile", "prefere les emails", AssistantMemory.Scope.FACT);
        AssistantMemory goal = new AssistantMemory(1L, "user-123",
                "Q3_target", "80% occupancy", AssistantMemory.Scope.GOAL);
        AssistantMemory project = new AssistantMemory(1L, "user-123",
                "renovation_paris", "juin 2026", AssistantMemory.Scope.PROJECT);

        when(memoryService.listForUser("user-123", 30))
                .thenReturn(List.of(pref, fact, goal, project));

        String prompt = orchestrator.buildSystemPrompt(ctx);

        assertTrue(prompt.startsWith("── Memoire utilisateur ──"),
                "La section memoire doit etre en tete");
        assertTrue(prompt.contains("Preferences : [briefing_time=08:00]"));
        assertTrue(prompt.contains("Faits : [owner_42_difficile=prefere les emails]"));
        assertTrue(prompt.contains("Objectifs : [Q3_target=80% occupancy]"));
        assertTrue(prompt.contains("Projets : [renovation_paris=juin 2026]"));
        assertTrue(prompt.contains("Tu es l'assistant strategique Clenzy"),
                "Le prompt par defaut suit la memoire");
    }

    @Test
    void buildSystemPrompt_memoryServiceFailure_fallsBackToDefault() {
        when(memoryService.listForUser(anyString(), anyInt()))
                .thenThrow(new RuntimeException("DB down"));

        String prompt = orchestrator.buildSystemPrompt(ctx);

        // Robustesse : on ne casse pas l'assistant si la memoire est ko
        assertNotNull(prompt);
        assertTrue(prompt.contains("Tu es l'assistant strategique Clenzy"));
        assertFalse(prompt.contains("── Memoire utilisateur ──"));
    }

    @Test
    void handleMessage_loadsMemoryFromService_limited30() {
        AssistantConversation saved = new AssistantConversation(1L, "user-123");
        saved.setId(99L);
        when(convRepo.save(any())).thenReturn(saved);
        when(msgRepo.findByConversation(99L)).thenReturn(List.of(
                AssistantMessage.user(99L, 1L, "hi")));

        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.TextDelta("ok"));
            consumer.accept(new ChatEvent.Done(10, 1, "claude", "end_turn", "ok"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        orchestrator.handleMessage(null, "hi", ctx, e -> {});

        // Verifie que la memoire est chargee avec la limite de 30
        verify(memoryService).listForUser(eq("user-123"), eq(30));
    }

    // ─── RAG auto-injection ──────────────────────────────────────────────

    @Test
    void buildSystemPrompt_withRagHitsAboveThreshold_prependsContextSection() {
        // Hits avec relevance >= 0.7 → doivent etre injectes
        when(kbSearchService.search(eq("comment configurer pricing"), eq(1L), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(java.util.List.of(
                        new com.clenzy.service.agent.kb.KbSearchService.KbSearchHit(
                                1L, 10L, "Pricing avance", "docs/pricing.md",
                                "Pour activer le pricing dynamique...", 0.92),
                        new com.clenzy.service.agent.kb.KbSearchService.KbSearchHit(
                                2L, 11L, "Yield rules", "docs/yield.md",
                                "Les yield rules permettent d'ajuster...", 0.78)
                ));

        String prompt = orchestrator.buildSystemPrompt(ctx, "comment configurer pricing");

        assertTrue(prompt.contains("── Contexte documentation pertinente ──"));
        assertTrue(prompt.contains("Pricing avance"));
        assertTrue(prompt.contains("docs/pricing.md"));
        assertTrue(prompt.contains("92%"));
        assertTrue(prompt.contains("Yield rules"));
        // Le prompt par defaut suit
        assertTrue(prompt.contains("Tu es l'assistant strategique Clenzy"));
    }

    @Test
    void buildSystemPrompt_ragHitsBelowThreshold_filtered() {
        // Hits avec relevance < 0.7 → ignores
        when(kbSearchService.search(anyString(), any(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(java.util.List.of(
                        new com.clenzy.service.agent.kb.KbSearchService.KbSearchHit(
                                1L, 10L, "Low rel", "docs/x.md", "Snippet faible", 0.55)
                ));

        String prompt = orchestrator.buildSystemPrompt(ctx, "question vague");
        assertFalse(prompt.contains("── Contexte documentation pertinente ──"));
    }

    @Test
    void buildSystemPrompt_nullLastMessage_skipsRagSearch() {
        orchestrator.buildSystemPrompt(ctx, null);
        // Pas d'appel au KB search si pas de message
        verify(kbSearchService, never()).search(anyString(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void buildSystemPrompt_ragFailure_silentlySkipped() {
        when(kbSearchService.search(anyString(), any(), org.mockito.ArgumentMatchers.anyInt()))
                .thenThrow(new RuntimeException("embed API down"));

        // Ne doit pas throw
        String prompt = orchestrator.buildSystemPrompt(ctx, "test");
        assertNotNull(prompt);
        assertFalse(prompt.contains("── Contexte documentation pertinente ──"));
    }

    @Test
    void buildSystemPrompt_combinesMemoryAndRagSections() {
        AssistantMemory pref = new AssistantMemory(1L, "user-123",
                "tz", "Europe/Paris", AssistantMemory.Scope.PREFERENCE);
        when(memoryService.listForUser("user-123", 30)).thenReturn(java.util.List.of(pref));
        when(kbSearchService.search(anyString(), any(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(java.util.List.of(
                        new com.clenzy.service.agent.kb.KbSearchService.KbSearchHit(
                                1L, 10L, "Article 4.2", "docs/p.md", "Procedure", 0.85)
                ));

        String prompt = orchestrator.buildSystemPrompt(ctx, "question");
        assertTrue(prompt.contains("── Memoire utilisateur ──"));
        assertTrue(prompt.contains("── Contexte documentation pertinente ──"));
        assertTrue(prompt.contains("Article 4.2"));
        // Ordre : memoire avant RAG avant default
        int memIdx = prompt.indexOf("Memoire utilisateur");
        int ragIdx = prompt.indexOf("Contexte documentation");
        int defaultIdx = prompt.indexOf("assistant strategique Clenzy");
        assertTrue(memIdx < ragIdx);
        assertTrue(ragIdx < defaultIdx);
    }

    // helper to silence "anyLong unused"
    private static long anyLong() { return org.mockito.ArgumentMatchers.anyLong(); }
}
