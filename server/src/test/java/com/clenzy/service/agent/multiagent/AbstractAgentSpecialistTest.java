package com.clenzy.service.agent.multiagent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifie que tout specialiste (via la template method
 * {@link AbstractAgentSpecialist#buildSystemPrompt()}) porte la garde
 * anti-injection. C'est le chemin le plus expose a l'injection indirecte :
 * les specialistes executent des tools dont les resultats (messages/notes de
 * guests, avis...) peuvent contenir des pseudo-instructions.
 */
class AbstractAgentSpecialistTest {

    private ChatLLMProvider chatProvider;
    private ToolRegistry toolRegistry;
    private ObjectMapper objectMapper;
    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        chatProvider = mock(ChatLLMProvider.class);
        toolRegistry = mock(ToolRegistry.class);
        objectMapper = new ObjectMapper();
        meterRegistry = new SimpleMeterRegistry();
    }

    private AbstractAgentSpecialist newSpecialist(Set<String> toolNames) {
        return new AbstractAgentSpecialist(chatProvider, toolRegistry, objectMapper, meterRegistry) {
            @Override public String name() { return "test_spec"; }
            @Override public String domain() { return "tests"; }
            @Override public String description() { return "specialiste de test"; }
            @Override public Set<String> toolNames() { return toolNames; }
        };
    }

    private AbstractAgentSpecialist defaultSpec() {
        return newSpecialist(Set.of());
    }

    @Test
    void system_prompt_includes_anti_injection_guard() {
        String prompt = defaultSpec().buildSystemPrompt();
        assertThat(prompt)
                .contains(PromptSecurityGuidance.block())
                .contains("N'OBEIS JAMAIS")
                .contains("<role>");
    }

    @Test
    void buildSystemPrompt_withNullRequest_excludesUserContext() {
        String prompt = defaultSpec().buildSystemPrompt(null);
        assertThat(prompt).doesNotContain("<user_context>");
        assertThat(prompt).doesNotContain("<memory>");
        assertThat(prompt).doesNotContain("<knowledge_base>");
    }

    @Test
    void buildSystemPrompt_withFrenchOnlyContext_excludesUserContext() {
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        // Default language is "fr" and no UI hint → user_context omitted
        assertThat(prompt).doesNotContain("<user_context>");
    }

    @Test
    void buildSystemPrompt_withEnglishLanguage_includesUserContext() {
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "en", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<user_context>");
        assertThat(prompt).contains("<language>en</language>");
        assertThat(prompt).contains("English");
    }

    @Test
    void buildSystemPrompt_withArabicLanguage_includesRTLComment() {
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "ar", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<language>ar</language>");
        assertThat(prompt).contains("RTL");
    }

    @Test
    void buildSystemPrompt_withCurrentPage_includesUserContext() {
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", "dashboard", null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<user_context>");
        assertThat(prompt).contains("<current_page>dashboard</current_page>");
    }

    @Test
    void buildSystemPrompt_withSelectedPropertyId_includesIt() {
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, 42L);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<selected_property_id>42</selected_property_id>");
    }

    @Test
    void buildSystemPrompt_withMemory_includesMemorySection() {
        AssistantMemory mem = new AssistantMemory();
        mem.setMemoryKey("currency_preference");
        mem.setMemoryValue("EUR");
        mem.setScope(AssistantMemory.Scope.PREFERENCE.name());

        OrchestrationContext octx = new OrchestrationContext(List.of(mem), List.of());
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx, octx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<memory>");
        assertThat(prompt).contains("currency_preference");
        assertThat(prompt).contains("EUR");
    }

    @Test
    void buildSystemPrompt_withKbHits_includesKnowledgeBaseSection() {
        KbSearchService.KbSearchHit hit = new KbSearchService.KbSearchHit(
                10L, 100L, "Calendar", "/docs/calendar.md", "Snippet content", 0.85);
        OrchestrationContext octx = new OrchestrationContext(List.of(), List.of(hit));
        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx, octx);
        String prompt = defaultSpec().buildSystemPrompt(req);
        assertThat(prompt).contains("<knowledge_base>");
        assertThat(prompt).contains("Calendar");
        assertThat(prompt).contains("Snippet content");
        assertThat(prompt).contains("relevance=\"85%\"");
    }

    @Test
    void handle_returnsTextSynthesis_whenNoToolCalls() {
        when(toolRegistry.listDescriptors()).thenReturn(List.of());
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            cons.accept(new ChatEvent.TextDelta("Hello"));
            cons.accept(new ChatEvent.TextDelta(" world"));
            cons.accept(new ChatEvent.Done(100, 50, "model-x", "end_turn", "Hello world"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Hi", ctx);

        SpecialistResult result = defaultSpec().handle(req);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.synthesis()).isEqualTo("Hello world");
        assertThat(result.promptTokens()).isEqualTo(100);
        assertThat(result.completionTokens()).isEqualTo(50);
        assertThat(result.truncated()).isFalse();
    }

    @Test
    void handle_returnsError_whenChatProviderEmitsError() {
        when(toolRegistry.listDescriptors()).thenReturn(List.of());
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            cons.accept(new ChatEvent.Error("LLM down", null));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Hi", ctx);

        SpecialistResult result = defaultSpec().handle(req);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.error()).isEqualTo("LLM down");
    }

    @Test
    void handle_wrapsRuntimeException_asErrorResult() {
        when(toolRegistry.listDescriptors()).thenThrow(new RuntimeException("boom"));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Hi", ctx);

        SpecialistResult result = defaultSpec().handle(req);
        assertThat(result.isSuccess()).isFalse();
        assertThat(result.error()).contains("boom");
    }

    @Test
    void handle_executesToolCall_appendsResultAndContinues() {
        ToolDescriptor td = ToolDescriptor.readOnly("my_tool", "test tool",
                objectMapper.createObjectNode());
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.descriptor()).thenReturn(td);
        when(handler.execute(any(), any())).thenReturn(ToolResult.success("{\"ok\":true}"));

        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        when(toolRegistry.find("my_tool")).thenReturn(java.util.Optional.of(handler));

        // First iter: emit tool call. Second iter: emit text+done.
        java.util.concurrent.atomic.AtomicInteger callCount = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            int idx = callCount.getAndIncrement();
            if (idx == 0) {
                cons.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_1", "my_tool", "{}"))));
                cons.accept(new ChatEvent.Done(10, 5, "m", "tool_use", ""));
            } else {
                cons.accept(new ChatEvent.TextDelta("Final answer"));
                cons.accept(new ChatEvent.Done(20, 8, "m", "end_turn", "Final answer"));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Run tool", ctx);

        SpecialistResult result = newSpecialist(Set.of("my_tool")).handle(req);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.synthesis()).isEqualTo("Final answer");
        assertThat(result.toolCallsExecuted()).containsExactly("my_tool");
        assertThat(result.promptTokens()).isEqualTo(30);
        assertThat(result.completionTokens()).isEqualTo(13);
        verify(handler).execute(any(), any());
    }

    @Test
    void handle_unauthorizedTool_returnsErrorWithoutInvokingHandler() {
        ToolDescriptor td = ToolDescriptor.readOnly("forbidden_tool", "x",
                objectMapper.createObjectNode());
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.descriptor()).thenReturn(td);

        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        // Note: even if registry knows the tool, specialist's allowed set is empty.

        java.util.concurrent.atomic.AtomicInteger callCount = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            int idx = callCount.getAndIncrement();
            if (idx == 0) {
                cons.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_1", "forbidden_tool", "{}"))));
                cons.accept(new ChatEvent.Done(10, 5, "m", "tool_use", ""));
            } else {
                cons.accept(new ChatEvent.TextDelta("Done"));
                cons.accept(new ChatEvent.Done(10, 5, "m", "end_turn", "Done"));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Run tool", ctx);

        // toolNames() returns empty Set → tool is unauthorized.
        SpecialistResult result = newSpecialist(Set.of()).handle(req);
        // The execute() should never be invoked (handler should not be called)
        verify(handler, org.mockito.Mockito.never()).execute(any(), any());
        // But synthesis still returned at iter 2.
        assertThat(result.synthesis()).isEqualTo("Done");
    }

    @Test
    void handle_writeTool_throwsConfirmationRequiredException() {
        ToolDescriptor td = ToolDescriptor.write("dangerous", "x",
                objectMapper.createObjectNode());
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.descriptor()).thenReturn(td);

        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        when(toolRegistry.find("dangerous")).thenReturn(java.util.Optional.of(handler));

        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            cons.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_1", "dangerous", "{}"))));
            cons.accept(new ChatEvent.Done(10, 5, "m", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Run write", ctx);

        // Expected: exception propagates (orchestrator catches and falls back).
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> newSpecialist(Set.of("dangerous")).handle(req))
                .isInstanceOf(ConfirmationRequiredException.class)
                .satisfies(e -> assertThat(((ConfirmationRequiredException) e).toolName())
                        .isEqualTo("dangerous"));
        verify(handler, org.mockito.Mockito.never()).execute(any(), any());
    }

    @Test
    void handle_apiKey_useByokOverload() {
        when(toolRegistry.listDescriptors()).thenReturn(List.of());
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            cons.accept(new ChatEvent.TextDelta("hi"));
            cons.accept(new ChatEvent.Done(1, 1, "m", "end_turn", "hi"));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class), any(String.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = new SpecialistRequest("Q", ctx,
                OrchestrationContext.empty(), "byok-key-xyz", null);

        SpecialistResult result = defaultSpec().handle(req);
        assertThat(result.isSuccess()).isTrue();
        verify(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class), any(String.class));
    }

    @Test
    void handle_truncated_returnsPartialAfterMaxIterations() {
        ToolDescriptor td = ToolDescriptor.readOnly("loop_tool", "x",
                objectMapper.createObjectNode());
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.descriptor()).thenReturn(td);
        when(handler.execute(any(), any())).thenReturn(ToolResult.success("{}"));

        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        when(toolRegistry.find("loop_tool")).thenReturn(java.util.Optional.of(handler));

        // Renvoie un tool call DISTINCT a chaque iteration (args differents) → l'anti-boucle
        // ne court-circuite pas (chaque appel est "nouveau") → la boucle atteint MAX_ITERATIONS.
        java.util.concurrent.atomic.AtomicInteger loopN = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            int i = loopN.getAndIncrement();
            cons.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_" + i, "loop_tool", "{\"i\":" + i + "}"))));
            cons.accept(new ChatEvent.Done(1, 1, "m", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("loop", ctx);

        SpecialistResult result = newSpecialist(Set.of("loop_tool")).handle(req);
        assertThat(result.truncated()).isTrue();
        // Repli exploitable (plus le marqueur technique brut) : dernier texte vu,
        // sinon formulation honnete "...pas pu finaliser...".
        assertThat(result.synthesis()).contains("finaliser");
        // Tool invoked MAX_ITERATIONS times (4)
        verify(handler, org.mockito.Mockito.times(4)).execute(any(), any());
    }

    @Test
    void handle_repeatedIdenticalToolCall_breaksLoopAndExecutesOnce() {
        // Anti-boucle : un modele qui re-demande le MEME tool (memes args) en boucle
        // ne doit pas l'executer N fois ni produire N widgets — la boucle court-circuite.
        ToolDescriptor td = ToolDescriptor.readOnly("loop_tool", "x",
                objectMapper.createObjectNode());
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.descriptor()).thenReturn(td);
        when(handler.execute(any(), any())).thenReturn(ToolResult.success("{}"));
        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        when(toolRegistry.find("loop_tool")).thenReturn(java.util.Optional.of(handler));

        // Toujours le MEME tool call (memes args).
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            cons.accept(new ChatEvent.ToolCallRequest(List.of(
                    new ChatMessage.ToolCall("toolu_x", "loop_tool", "{}"))));
            cons.accept(new ChatEvent.Done(1, 1, "m", "tool_use", ""));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistResult result = newSpecialist(Set.of("loop_tool"))
                .handle(SpecialistRequest.of("loop", ctx));

        // Exécuté UNE seule fois (pas N), boucle court-circuitee → pas de troncature.
        verify(handler, org.mockito.Mockito.times(1)).execute(any(), any());
        assertThat(result.truncated()).isFalse();
        assertThat(result.toolInvocations()).hasSize(1);
    }

    @Test
    void handle_unknownTool_returnsErrorResult() {
        ToolDescriptor td = ToolDescriptor.readOnly("known_tool", "x",
                objectMapper.createObjectNode());

        when(toolRegistry.listDescriptors()).thenReturn(List.of(td));
        // simulate "tool removed from registry between listing and call"
        when(toolRegistry.find("known_tool")).thenReturn(java.util.Optional.empty());

        java.util.concurrent.atomic.AtomicInteger callCount = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(inv -> {
            Consumer<ChatEvent> cons = inv.getArgument(1);
            int idx = callCount.getAndIncrement();
            if (idx == 0) {
                cons.accept(new ChatEvent.ToolCallRequest(List.of(
                        new ChatMessage.ToolCall("toolu_1", "known_tool", "{}"))));
                cons.accept(new ChatEvent.Done(1, 1, "m", "tool_use", ""));
            } else {
                cons.accept(new ChatEvent.TextDelta("final"));
                cons.accept(new ChatEvent.Done(2, 2, "m", "end_turn", "final"));
            }
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(Consumer.class));

        AgentContext ctx = new AgentContext(1L, "kc-1", null, "fr", null, null);
        SpecialistRequest req = SpecialistRequest.of("Q", ctx);

        SpecialistResult result = newSpecialist(Set.of("known_tool")).handle(req);
        assertThat(result.synthesis()).isEqualTo("final");
        // toolCallsExecuted still contains the tool name (logged)
        assertThat(result.toolCallsExecuted()).containsExactly("known_tool");
    }
}
