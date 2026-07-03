package com.clenzy.testkit;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Predicate;

/**
 * Implementation scriptee de {@link ChatLLMProvider} pour les tests d'integration :
 * zero token reel, reponses deterministes (texte, tool_calls, tokens, modele)
 * definies par l'appelant.
 *
 * <p>Deux modes de scripting, combinables :
 * <ul>
 *   <li><b>Par pattern</b> ({@link #onRequest}, {@link #onLastUserMessageContains},
 *       {@link #onSystemPromptContains}) : la premiere regle dont le predicat matche
 *       la {@link ChatRequest} gagne. Les regles sont evaluees dans l'ordre
 *       d'enregistrement et sont reutilisables par defaut (voir {@code once}).</li>
 *   <li><b>Par sequence</b> ({@link #enqueue}) : file FIFO consommee quand aucune
 *       regle pattern ne matche. C'est la generalisation du {@code stubLlm(...)}
 *       des tests unitaires (cf. OrchestratorAgentTest).</li>
 * </ul>
 *
 * <p>Si aucun script ne couvre une requete, le provider emet un {@link ChatEvent.Error}
 * ET jette une {@link AssertionError} : un appel LLM non prevu par le test est
 * toujours un echec explicite, jamais un blocage silencieux.
 *
 * <p><b>Streaming</b> : le texte est emis en fragments {@link ChatEvent.TextDelta}
 * (decoupe naive en 2 morceaux si assez long) puis {@link ChatEvent.ToolCallRequest}
 * eventuel puis {@link ChatEvent.Done} — meme sequence que les providers reels,
 * dans le thread appelant (contrat {@link ChatLLMProvider#streamChat}).
 *
 * <p><b>Capture</b> : chaque appel est enregistre ({@link #capturedRequests()},
 * {@link #capturedApiKeys()}) pour les assertions (modele tier, BYOK, historique).
 * Thread-safe (l'assistant peut streamer hors du thread de test).
 */
public final class ScriptedChatLLMProvider implements ChatLLMProvider {

    /** Reponse scriptee unitaire (un "tour" LLM). */
    public record ScriptedResponse(
            String text,
            List<ChatMessage.ToolCall> toolCalls,
            int promptTokens,
            int completionTokens,
            String model,
            String errorMessage
    ) {

        public ScriptedResponse {
            toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
        }

        /** Tour texte simple (finish end_turn). */
        public static ScriptedResponse text(String text) {
            return new ScriptedResponse(text, List.of(), 50, 10, "scripted-model", null);
        }

        /** Tour tool_use : le modele demande l'execution d'outils. */
        public static ScriptedResponse toolCalls(ChatMessage.ToolCall... calls) {
            return new ScriptedResponse("", List.of(calls), 40, 5, "scripted-model", null);
        }

        /** Tour en erreur (stream casse, provider 500...). */
        public static ScriptedResponse error(String message) {
            return new ScriptedResponse(null, List.of(), 0, 0, "scripted-model", message);
        }

        public ScriptedResponse withTokens(int promptTokens, int completionTokens) {
            return new ScriptedResponse(text, toolCalls, promptTokens, completionTokens, model, errorMessage);
        }

        public ScriptedResponse withModel(String model) {
            return new ScriptedResponse(text, toolCalls, promptTokens, completionTokens, model, errorMessage);
        }

        private String finishReason() {
            return toolCalls.isEmpty() ? "end_turn" : "tool_use";
        }
    }

    private record Rule(Predicate<ChatRequest> matcher, ScriptedResponse response, boolean once) {
    }

    private final List<Rule> rules = Collections.synchronizedList(new ArrayList<>());
    private final Deque<ScriptedResponse> sequence = new ArrayDeque<>();
    private final List<ChatRequest> capturedRequests = Collections.synchronizedList(new ArrayList<>());
    private final List<String> capturedApiKeys = Collections.synchronizedList(new ArrayList<>());

    // ─── Scripting ──────────────────────────────────────────────────────────

    /** Regle par predicat arbitraire sur la requete (reutilisable). */
    public ScriptedChatLLMProvider onRequest(Predicate<ChatRequest> matcher, ScriptedResponse response) {
        rules.add(new Rule(Objects.requireNonNull(matcher), Objects.requireNonNull(response), false));
        return this;
    }

    /** Regle a usage unique (consommee au premier match). */
    public ScriptedChatLLMProvider onRequestOnce(Predicate<ChatRequest> matcher, ScriptedResponse response) {
        rules.add(new Rule(Objects.requireNonNull(matcher), Objects.requireNonNull(response), true));
        return this;
    }

    /** Regle : le DERNIER message user contient {@code needle}. */
    public ScriptedChatLLMProvider onLastUserMessageContains(String needle, ScriptedResponse response) {
        return onRequest(req -> lastUserContent(req).contains(needle), response);
    }

    /** Regle : le system prompt contient {@code needle} (routage classifieur, specialists...). */
    public ScriptedChatLLMProvider onSystemPromptContains(String needle, ScriptedResponse response) {
        return onRequest(req -> req.systemPrompt() != null && req.systemPrompt().contains(needle), response);
    }

    /** Empile une reponse dans la sequence FIFO (fallback quand aucune regle ne matche). */
    public ScriptedChatLLMProvider enqueue(ScriptedResponse response) {
        synchronized (sequence) {
            sequence.addLast(Objects.requireNonNull(response));
        }
        return this;
    }

    /** Vide scripts et captures (reutilisation du meme bean entre tests). */
    public void reset() {
        rules.clear();
        synchronized (sequence) {
            sequence.clear();
        }
        capturedRequests.clear();
        capturedApiKeys.clear();
    }

    // ─── Captures ───────────────────────────────────────────────────────────

    /** Toutes les requetes recues, dans l'ordre d'appel. */
    public List<ChatRequest> capturedRequests() {
        return List.copyOf(capturedRequests);
    }

    /** Cles API BYOK recues (null = cle plateforme), alignees sur {@link #capturedRequests()}. */
    public List<String> capturedApiKeys() {
        return Collections.unmodifiableList(new ArrayList<>(capturedApiKeys));
    }

    public int callCount() {
        return capturedRequests.size();
    }

    // ─── ChatLLMProvider ────────────────────────────────────────────────────

    @Override
    public String name() {
        return "scripted";
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
        streamChat(request, consumer, null);
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        capturedRequests.add(request);
        capturedApiKeys.add(apiKey);

        ScriptedResponse response = resolve(request);
        if (response == null) {
            String summary = describe(request);
            consumer.accept(new ChatEvent.Error("ScriptedChatLLMProvider: aucun script pour la requete " + summary, null));
            throw new AssertionError("Appel LLM non scripte — ajoute une regle ou un enqueue() pour : " + summary);
        }
        emit(response, consumer);
    }

    private ScriptedResponse resolve(ChatRequest request) {
        synchronized (rules) {
            for (int i = 0; i < rules.size(); i++) {
                Rule rule = rules.get(i);
                if (rule.matcher().test(request)) {
                    if (rule.once()) {
                        rules.remove(i);
                    }
                    return rule.response();
                }
            }
        }
        synchronized (sequence) {
            return sequence.pollFirst();
        }
    }

    private void emit(ScriptedResponse response, Consumer<ChatEvent> consumer) {
        if (response.errorMessage() != null) {
            consumer.accept(new ChatEvent.Error(response.errorMessage(), null));
            return;
        }
        String text = response.text() == null ? "" : response.text();
        if (!text.isEmpty()) {
            // 2 fragments pour exercer la concatenation streaming des appelants.
            int mid = text.length() / 2;
            if (mid > 0) {
                consumer.accept(new ChatEvent.TextDelta(text.substring(0, mid)));
                consumer.accept(new ChatEvent.TextDelta(text.substring(mid)));
            } else {
                consumer.accept(new ChatEvent.TextDelta(text));
            }
        }
        if (!response.toolCalls().isEmpty()) {
            consumer.accept(new ChatEvent.ToolCallRequest(response.toolCalls()));
        }
        consumer.accept(new ChatEvent.Done(
                response.promptTokens(),
                response.completionTokens(),
                response.model(),
                response.finishReason(),
                text));
    }

    private static String lastUserContent(ChatRequest request) {
        for (int i = request.messages().size() - 1; i >= 0; i--) {
            ChatMessage m = request.messages().get(i);
            if (ChatMessage.ROLE_USER.equals(m.role()) && m.content() != null) {
                return m.content();
            }
        }
        return "";
    }

    private static String describe(ChatRequest request) {
        String lastUser = lastUserContent(request);
        return "{model=" + request.model()
                + ", provider=" + request.provider()
                + ", messages=" + request.messages().size()
                + ", lastUser=\"" + (lastUser.length() > 120 ? lastUser.substring(0, 120) + "..." : lastUser) + "\"}";
    }
}
