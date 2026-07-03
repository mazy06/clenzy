package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.service.ResolvedTarget;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests du routeur d'intention pre-orchestration (T-02) : classification
 * DIRECT/SIMPLE/MULTI, biais de securite vers MULTI (reponse inattendue,
 * erreur provider, message vide), et compteur de decisions.
 */
class IntentRouterTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final ResolvedTarget target = new ResolvedTarget(
            "anthropic", "claude-sonnet-4", "sk-test", null, null);

    /** Provider stub qui repond un texte fixe (usage 42/2 tokens). */
    private ChatLLMProvider providerAnswering(String answer) {
        return new ChatLLMProvider() {
            @Override public String name() { return "stub"; }
            @Override public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
                consumer.accept(new ChatEvent.Done(42, 2, request.model(), "end_turn", answer));
            }
        };
    }

    private ChatLLMProvider providerThrowing() {
        return new ChatLLMProvider() {
            @Override public String name() { return "stub"; }
            @Override public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
                throw new RuntimeException("provider down");
            }
        };
    }

    private IntentRouter router(ChatLLMProvider provider) {
        return new IntentRouter(provider, registry, null, true, "");
    }

    private double decisionCount(String route) {
        var c = registry.find(IntentRouter.ROUTING_DECISIONS).tag("route", route).counter();
        return c == null ? 0d : c.count();
    }

    @Test
    void simpleAnswer_routesToSimple_andReportsUsage() {
        IntentRouter.RouteDecision d = router(providerAnswering("SIMPLE"))
                .classify("Liste mes réservations de juillet", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.SIMPLE);
        assertThat(d.promptTokens()).isEqualTo(42);
        assertThat(d.completionTokens()).isEqualTo(2);
        assertThat(decisionCount("simple")).isEqualTo(1d);
    }

    @Test
    void directAnswer_routesToDirect() {
        IntentRouter.RouteDecision d = router(providerAnswering("DIRECT"))
                .classify("Bonjour, tu vas bien ?", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.DIRECT);
        assertThat(decisionCount("direct")).isEqualTo(1d);
    }

    @Test
    void multiAnswer_routesToMulti() {
        IntentRouter.RouteDecision d = router(providerAnswering("MULTI"))
                .classify("Analyse mes performances et propose un plan d'action", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.MULTI);
        assertThat(decisionCount("multi")).isEqualTo(1d);
    }

    @Test
    void answerWithNoiseAroundKeyword_stillParsed() {
        IntentRouter.RouteDecision d = router(providerAnswering("  simple\n"))
                .classify("Quel est le prix de la nuit du 12 ?", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.SIMPLE);
    }

    @Test
    void unexpectedAnswer_fallsBackToMulti() {
        IntentRouter.RouteDecision d = router(providerAnswering("PEUT-ETRE"))
                .classify("Question ambigue", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.MULTI);
        assertThat(decisionCount("error_fallback")).isEqualTo(1d);
    }

    @Test
    void providerError_fallsBackToMulti_neverThrows() {
        IntentRouter.RouteDecision d = router(providerThrowing())
                .classify("N'importe quoi", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.MULTI);
        assertThat(decisionCount("error_fallback")).isEqualTo(1d);
    }

    @Test
    void blankMessage_fallsBackToMulti_withoutLlmCall() {
        IntentRouter.RouteDecision d = router(providerThrowing())
                .classify("   ", target, null);

        assertThat(d.route()).isEqualTo(IntentRouter.Route.MULTI);
        assertThat(d.promptTokens()).isZero();
        assertThat(decisionCount("blank_message")).isEqualTo(1d);
    }

    @Test
    void routingModelOverride_takesPrecedenceOverTargetModel() {
        final String[] modelUsed = {null};
        ChatLLMProvider capturing = new ChatLLMProvider() {
            @Override public String name() { return "stub"; }
            @Override public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
                modelUsed[0] = request.model();
                consumer.accept(new ChatEvent.Done(1, 1, request.model(), "end_turn", "SIMPLE"));
            }
        };
        IntentRouter overridden = new IntentRouter(capturing, registry, null, true, "claude-haiku-4-5");

        overridden.classify("Liste mes factures", target, null);

        assertThat(modelUsed[0]).isEqualTo("claude-haiku-4-5");
    }

    @Test
    void longMessage_isTruncatedBeforeClassification() {
        final String[] sent = {null};
        ChatLLMProvider capturing = new ChatLLMProvider() {
            @Override public String name() { return "stub"; }
            @Override public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
                sent[0] = request.messages().get(0).content();
                consumer.accept(new ChatEvent.Done(1, 1, request.model(), "end_turn", "MULTI"));
            }
        };

        router(capturing).classify("x".repeat(2000), target, null);

        assertThat(sent[0]).hasSize(400);
    }
}
