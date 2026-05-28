package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService.KbSearchHit;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unit du flow d'orchestration. Mock le ChatLLMProvider pour simuler
 * les responses LLM sans appeler Anthropic.
 */
class OrchestratorAgentTest {

    private ChatLLMProvider chatProvider;
    private AgentSpecialist dataAnalyst;
    private SpecialistRegistry registry;
    private ObjectMapper objectMapper;
    private OrchestratorAgent orchestrator;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        dataAnalyst = mock(AgentSpecialist.class);
        when(dataAnalyst.name()).thenReturn("data_analyst");
        when(dataAnalyst.domain()).thenReturn("Analyse donnees");
        when(dataAnalyst.description()).thenReturn("Pour les questions de KPIs et de chiffres");
        when(dataAnalyst.toolNames()).thenReturn(Set.of("list_properties"));

        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(dataAnalyst));
        registry = new SpecialistRegistry(provider);
        registry.initialize();

        objectMapper = new ObjectMapper();
        orchestrator = new OrchestratorAgent(chatProvider, registry, objectMapper, new SimpleMeterRegistry());
    }

    @Test
    void empty_registry_returns_error() {
        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> empty = mock(ObjectProvider.class);
        when(empty.stream()).thenAnswer(inv -> Stream.empty());
        SpecialistRegistry emptyRegistry = new SpecialistRegistry(empty);
        emptyRegistry.initialize();
        OrchestratorAgent o = new OrchestratorAgent(chatProvider, emptyRegistry, objectMapper, new SimpleMeterRegistry());

        OrchestratorAgent.OrchestrationResult r = o.orchestrate("hello", AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.error()).contains("Aucun specialiste");
    }

    @Test
    void orchestrator_emits_text_only_returns_direct_response() {
        // LLM #1 : pas de tool, juste du texte → orchestration termine au tour 1
        stubLlm("Bonjour, comment puis-je t'aider ?", List.of(), 50, 10);

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate("Bonjour", AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.finalText()).isEqualTo("Bonjour, comment puis-je t'aider ?");
        assertThat(r.delegationsLog()).isEmpty();
        assertThat(r.totalPromptTokens()).isEqualTo(50);
        assertThat(r.totalCompletionTokens()).isEqualTo(10);
    }

    @Test
    void orchestrator_delegates_then_summarizes() {
        // Tour 1 : delegate_to(data_analyst, "...") puis tour 2 : reponse synthese
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste mes proprietes\"}"
        );

        // Le specialist retourne une synthese
        when(dataAnalyst.handle(any(SpecialistRequest.class))).thenReturn(
                SpecialistResult.success("Tu as 5 proprietes : A, B, C, D, E", List.of("list_properties"), 30, 15)
        );

        // 1er call : emet le tool_call. 2eme call : emet le texte final.
        AtomicInteger callCount = new AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount.getAndIncrement() == 0) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(delegate)));
                consumer.accept(new ChatEvent.Done(40, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Tu as 5 biens. "));
                consumer.accept(new ChatEvent.TextDelta("Voici la liste."));
                consumer.accept(new ChatEvent.Done(60, 10, "claude", "end_turn", "Tu as 5 biens. Voici la liste."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate("liste mes proprietes", AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.finalText()).contains("Tu as 5 biens");
        assertThat(r.delegationsLog()).hasSize(1);
        assertThat(r.delegationsLog().get(0)).contains("data_analyst").contains("OK");
        // Tokens cumulés (orchestrator + specialist)
        assertThat(r.totalPromptTokens()).isEqualTo(40 + 60 + 30);
        assertThat(r.totalCompletionTokens()).isEqualTo(5 + 10 + 15);
        verify(dataAnalyst).handle(any(SpecialistRequest.class));
    }

    @Test
    void orchestrator_handles_unknown_specialist_gracefully() {
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"ghost\",\"query\":\"...\"}"
        );

        AtomicInteger callCount = new AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount.getAndIncrement() == 0) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(delegate)));
                consumer.accept(new ChatEvent.Done(40, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Specialiste inconnu, desole."));
                consumer.accept(new ChatEvent.Done(50, 8, "claude", "end_turn", "Specialiste inconnu, desole."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate("query", AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isTrue();
        // Le tour 2 voit le tool_result indiquant que ghost n'existe pas, l'orchestrator s'adapte
        assertThat(r.delegationsLog()).hasSize(1);
        assertThat(r.delegationsLog().get(0)).contains("ghost").contains("ERR");
    }

    @Test
    void llm_error_returns_error_result() {
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            consumer.accept(new ChatEvent.Error("Anthropic 500", null));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate("query", AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.error()).contains("Anthropic 500");
    }

    @Test
    void orchestrate_with_history_passes_full_conversation_to_llm() {
        // Fix bloquant #2 : l'orchestrator DOIT transmettre l'historique complet
        // au LLM (user + assistant + tool messages), pas juste le dernier user.
        List<ChatMessage> history = List.of(
                ChatMessage.user("Bonjour"),
                ChatMessage.assistant("Bonjour, comment puis-je t'aider ?"),
                ChatMessage.user("liste mes proprietes a Paris")
        );
        stubLlm("Tu as 3 biens a Paris.", List.of(), 80, 12);

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate(history,
                AgentContext.minimal(1L, "kc"));

        assertThat(r.isSuccess()).isTrue();

        // Verifier que le ChatRequest envoye au LLM contient bien les 3 messages
        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        ChatRequest sent = reqCaptor.getValue();
        assertThat(sent.messages()).hasSize(3);
        assertThat(sent.messages().get(0).role()).isEqualTo(ChatMessage.ROLE_USER);
        assertThat(sent.messages().get(1).role()).isEqualTo(ChatMessage.ROLE_ASSISTANT);
        assertThat(sent.messages().get(2).content()).contains("Paris");
    }

    @Test
    void orchestrate_legacy_string_signature_wraps_into_single_user_message() {
        // Backwards compat : la signature 2-arg ne casse pas, elle wrap juste
        // le message dans une liste a 1 element.
        stubLlm("Bonjour !", List.of(), 30, 5);

        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate("Salut",
                AgentContext.minimal(1L, "kc"));

        assertThat(r.isSuccess()).isTrue();

        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        assertThat(reqCaptor.getValue().messages()).hasSize(1);
        assertThat(reqCaptor.getValue().messages().get(0).content()).isEqualTo("Salut");
    }

    @Test
    void orchestrate_with_empty_history_returns_error() {
        OrchestratorAgent.OrchestrationResult r = orchestrator.orchestrate(List.of(),
                AgentContext.minimal(1L, "kc"));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.error()).contains("vide");
    }

    @Test
    void orchestrate_with_memory_injects_memory_section_in_system_prompt() {
        // Fix bloquant #3 : la memoire long-terme DOIT etre injectee dans le
        // system prompt de l'orchestrator pour qu'il personnalise la query.
        AssistantMemory memory = new AssistantMemory(1L, "kc", "currency",
                "EUR", AssistantMemory.Scope.PREFERENCE);
        OrchestrationContext ctx = new OrchestrationContext(List.of(memory), List.of());

        stubLlm("Tu as 5 biens.", List.of(), 50, 10);

        orchestrator.orchestrate(List.of(ChatMessage.user("liste mes biens")),
                AgentContext.minimal(1L, "kc"), ctx);

        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        String sysPrompt = reqCaptor.getValue().systemPrompt();
        assertThat(sysPrompt)
                .contains("<memory>")
                .contains("scope=\"preference\"")
                .contains("key=\"currency\"")
                .contains("EUR")
                .contains("</memory>");
    }

    @Test
    void orchestrate_with_kb_hits_injects_knowledge_base_section() {
        // Fix bloquant #3 : les snippets RAG DOIVENT etre injectes pour citation.
        KbSearchHit hit = new KbSearchHit(1L, 1L, "Tarification dynamique",
                "/docs/pricing.md",
                "Le pricing engine resout 6 niveaux : RateOverride > Promotional > ...",
                0.92);
        OrchestrationContext ctx = new OrchestrationContext(List.of(), List.of(hit));

        stubLlm("Voici le pricing.", List.of(), 50, 10);

        orchestrator.orchestrate(List.of(ChatMessage.user("comment marche le pricing ?")),
                AgentContext.minimal(1L, "kc"), ctx);

        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        String sysPrompt = reqCaptor.getValue().systemPrompt();
        assertThat(sysPrompt)
                .contains("<knowledge_base>")
                .contains("title=\"Tarification dynamique\"")
                .contains("path=\"/docs/pricing.md\"")
                .contains("relevance=\"92%\"")
                .contains("RateOverride")
                .contains("</knowledge_base>");
    }

    @Test
    void orchestrate_with_empty_context_omits_memory_and_kb_sections() {
        // Pas de pollution du prompt quand pas de memoire/RAG.
        stubLlm("Bonjour !", List.of(), 30, 5);

        orchestrator.orchestrate(List.of(ChatMessage.user("hello")),
                AgentContext.minimal(1L, "kc"), OrchestrationContext.empty());

        ArgumentCaptor<ChatRequest> reqCaptor = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(reqCaptor.capture(), any());
        String sysPrompt = reqCaptor.getValue().systemPrompt();
        assertThat(sysPrompt)
                .doesNotContain("<memory>")
                .doesNotContain("<knowledge_base>")
                .contains("<role>")  // sections statiques toujours la
                .contains("<specialists>");
    }

    @Test
    void orchestrate_propagates_orchestration_context_to_specialist() {
        // Fix bloquant #3 : les specialists doivent recevoir le contexte aussi.
        ChatMessage.ToolCall delegate = new ChatMessage.ToolCall(
                "tc1", "delegate_to",
                "{\"specialist\":\"data_analyst\",\"query\":\"liste les biens en EUR\"}"
        );

        ArgumentCaptor<SpecialistRequest> specReqCaptor =
                ArgumentCaptor.forClass(SpecialistRequest.class);
        when(dataAnalyst.handle(specReqCaptor.capture())).thenReturn(
                SpecialistResult.success("Tu as 5 biens.", List.of("list_properties"), 30, 15)
        );

        AtomicInteger callCount = new AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (callCount.getAndIncrement() == 0) {
                consumer.accept(new ChatEvent.ToolCallRequest(List.of(delegate)));
                consumer.accept(new ChatEvent.Done(40, 5, "claude", "tool_use", ""));
            } else {
                consumer.accept(new ChatEvent.TextDelta("Tu as 5 biens en EUR."));
                consumer.accept(new ChatEvent.Done(60, 10, "claude", "end_turn", "Tu as 5 biens en EUR."));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());

        AssistantMemory memory = new AssistantMemory(1L, "kc", "currency",
                "EUR", AssistantMemory.Scope.PREFERENCE);
        OrchestrationContext ctx = new OrchestrationContext(List.of(memory), List.of());

        orchestrator.orchestrate(List.of(ChatMessage.user("liste mes biens")),
                AgentContext.minimal(1L, "kc"), ctx);

        // Le specialist a recu le meme contexte
        SpecialistRequest received = specReqCaptor.getValue();
        assertThat(received.orchestrationCtx()).isNotNull();
        assertThat(received.orchestrationCtx().memories()).hasSize(1);
        assertThat(received.orchestrationCtx().memories().get(0).getMemoryKey()).isEqualTo("currency");
    }

    @Test
    void system_prompt_lists_all_specialists_and_their_descriptions() {
        String prompt = orchestrator.buildOrchestratorSystemPrompt();
        assertThat(prompt)
                .contains("<role>")
                .contains("<specialists>")
                .contains("<name>data_analyst</name>")
                .contains("KPIs")
                .contains("<workflow>")
                .contains("delegate_to")
                .contains("max 3")  // valeur de MAX_DELEGATIONS interpolee dans le prompt
                .doesNotContain("undefined");
    }

    /** Stub generique : LLM renvoie texte + done. */
    private void stubLlm(String text, List<ChatMessage.ToolCall> toolCalls, int promptTokens, int completionTokens) {
        doAnswer(inv -> {
            Consumer<ChatEvent> consumer = inv.getArgument(1);
            if (!text.isEmpty()) {
                consumer.accept(new ChatEvent.TextDelta(text));
            }
            if (!toolCalls.isEmpty()) {
                consumer.accept(new ChatEvent.ToolCallRequest(toolCalls));
            }
            consumer.accept(new ChatEvent.Done(promptTokens, completionTokens, "claude",
                    toolCalls.isEmpty() ? "end_turn" : "tool_use", text));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }
}
