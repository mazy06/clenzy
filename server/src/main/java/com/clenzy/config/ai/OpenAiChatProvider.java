package com.clenzy.config.ai;

import com.clenzy.config.AiProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.stream.Stream;

/**
 * Implementation OpenAI-compatible du {@link ChatLLMProvider} : chat multi-turn,
 * streaming SSE, tool calling (function calling).
 *
 * <p>Cible l'endpoint {@code POST {baseUrl}/chat/completions} avec {@code stream: true}.
 * Le MEME provider sert OpenAI ET tous les endpoints OpenAI-compatibles (NVIDIA Build,
 * proxy Bedrock, etc.) : seuls la {@link ChatRequest#baseUrl()}, la cle et le
 * {@link ChatRequest#model()} changent. C'est exactement le format que
 * {@link BedrockProvider} sert deja pour les features single-turn.</p>
 *
 * <p><b>Tool calling</b> : les {@code tool_calls} OpenAI arrivent en streaming par
 * fragments (index + id/name au 1er chunk, puis fragments de {@code function.arguments}).
 * On les accumule par index puis on emet un {@link ChatEvent.ToolCallRequest} en fin de
 * stream quand {@code finish_reason == "tool_calls"}.</p>
 *
 * <p><b>Vision</b> : les attachments image sont convertis en blocs
 * {@code {type:"image_url", image_url:{url:"data:...;base64,..."}}} (compatibles GPT-4o
 * et modeles vision OpenAI-compatibles).</p>
 *
 * <p><b>Securite</b> : la cle n'est jamais loggee, le contenu des messages non plus
 * (au plus le nombre de messages, le modele, le finishReason).</p>
 */
@Component
public class OpenAiChatProvider implements ChatLLMProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiChatProvider.class);
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(2);
    private static final String DONE_SENTINEL = "[DONE]";

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final HttpClient httpClient;

    public OpenAiChatProvider(AiProperties aiProperties,
                               ObjectMapper objectMapper,
                               ApplicationEventPublisher eventPublisher) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
        AiProperties.OpenAi config = aiProperties.getOpenai();
        doStream(request, consumer, config.getApiKey(), resolveBaseUrl(request, config));
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        AiProperties.OpenAi config = aiProperties.getOpenai();
        String effectiveKey = (apiKey == null || apiKey.isBlank()) ? config.getApiKey() : apiKey;
        doStream(request, consumer, effectiveKey, resolveBaseUrl(request, config));
    }

    /** baseUrl de la requete (modele plateforme NVIDIA/Bedrock) sinon defaut OpenAI. */
    private String resolveBaseUrl(ChatRequest request, AiProperties.OpenAi config) {
        if (request.baseUrl() != null && !request.baseUrl().isBlank()) {
            return request.baseUrl();
        }
        return config.getBaseUrl();
    }

    // ─── Core streaming logic ──────────────────────────────────────────────

    private void doStream(ChatRequest request, Consumer<ChatEvent> consumer,
                          String apiKey, String baseUrl) {
        String providerLabel = request.provider() != null ? request.provider() : "openai";
        if (apiKey == null || apiKey.isBlank()) {
            consumer.accept(new ChatEvent.Error(
                    "Aucune cle API configuree pour le provider '" + providerLabel + "'. "
                            + "Connecte une cle dans Settings > IA ou configure la cle plateforme.", null));
            return;
        }

        String model = request.model() != null ? request.model() : aiProperties.getOpenai().getModel();
        String body;
        try {
            body = objectMapper.writeValueAsString(buildRequestBody(request, model));
        } catch (JsonProcessingException e) {
            consumer.accept(new ChatEvent.Error("Failed to serialize request: " + e.getMessage(), e));
            return;
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/chat/completions"))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        log.debug("openai.streamChat provider={} model={} messages={} tools={}",
                providerLabel, model, request.messages().size(), request.tools().size());

        try {
            HttpResponse<Stream<String>> response = httpClient.send(
                    httpRequest, HttpResponse.BodyHandlers.ofLines());

            if (response.statusCode() == 410) {
                String responseBody = response.body().reduce("", (a, b) -> a + b);
                log.warn("{} API: modele '{}' obsolete (410 Gone). Reponse: {}", providerLabel, model, responseBody);
                if (eventPublisher != null) {
                    eventPublisher.publishEvent(new AiModelDeprecatedEvent(providerLabel, model, responseBody));
                }
                consumer.accept(new ChatEvent.Error(
                        "Le modele '" + model + "' n'est plus disponible chez " + providerLabel + ". "
                                + "Selectionnez un nouveau modele dans Parametres > IA et sauvegardez.",
                        null));
                return;
            }

            if (response.statusCode() >= 400) {
                String responseBody = response.body().reduce("", (a, b) -> a + b);
                log.error("{} API call failed: status={} body={}", providerLabel, response.statusCode(), responseBody);
                consumer.accept(new ChatEvent.Error(
                        providerLabel + " API returned status " + response.statusCode(), null));
                return;
            }

            parseStream(response.body(), model, consumer);
        } catch (Exception e) {
            log.error("{} streamChat failed: {}", providerLabel, e.getMessage());
            consumer.accept(new ChatEvent.Error(providerLabel + " streamChat failed: " + e.getMessage(), e));
        }
    }

    // ─── SSE parsing ──────────────────────────────────────────────────────

    /**
     * Visible for testing — parse un flux SSE OpenAI ({@code data: {...}} / {@code data: [DONE]})
     * et emet les ChatEvent correspondants. Ne fait pas d'appel reseau.
     */
    void parseStream(Stream<String> lines, String modelHint, Consumer<ChatEvent> consumer) {
        StringBuilder fullText = new StringBuilder();
        // Tool calls accumules par index (TreeMap pour conserver l'ordre des index).
        Map<Integer, ToolCallBuilder> pendingTools = new TreeMap<>();

        int[] promptTokens = {0};
        int[] completionTokens = {0};
        String[] finishReason = {null};
        String[] usedModel = {modelHint};

        lines.forEach(line -> {
            if (line == null || line.isEmpty()) return;
            if (!line.startsWith("data:")) return;
            String json = line.substring(5).trim();
            if (json.isEmpty() || DONE_SENTINEL.equals(json)) return;

            try {
                JsonNode chunk = objectMapper.readTree(json);
                if (chunk.has("model")) {
                    usedModel[0] = chunk.path("model").asText(modelHint);
                }

                // Usage final (stream_options.include_usage=true) : chunk avec choices vide.
                JsonNode usage = chunk.path("usage");
                if (usage.isObject()) {
                    if (usage.has("prompt_tokens")) promptTokens[0] = usage.path("prompt_tokens").asInt(promptTokens[0]);
                    if (usage.has("completion_tokens")) completionTokens[0] = usage.path("completion_tokens").asInt(completionTokens[0]);
                }

                JsonNode choices = chunk.path("choices");
                if (!choices.isArray() || choices.isEmpty()) return;
                JsonNode choice = choices.get(0);

                if (choice.hasNonNull("finish_reason")) {
                    finishReason[0] = choice.path("finish_reason").asText(null);
                }

                JsonNode delta = choice.path("delta");
                JsonNode contentNode = delta.path("content");
                if (contentNode.isTextual()) {
                    String text = contentNode.asText("");
                    if (!text.isEmpty()) {
                        fullText.append(text);
                        consumer.accept(new ChatEvent.TextDelta(text));
                    }
                }

                JsonNode toolCalls = delta.path("tool_calls");
                if (toolCalls.isArray()) {
                    for (JsonNode tc : toolCalls) {
                        int index = tc.path("index").asInt(0);
                        ToolCallBuilder b = pendingTools.computeIfAbsent(index, k -> new ToolCallBuilder());
                        if (tc.hasNonNull("id")) b.id = tc.path("id").asText(b.id);
                        JsonNode fn = tc.path("function");
                        if (fn.hasNonNull("name")) b.name = fn.path("name").asText(b.name);
                        if (fn.hasNonNull("arguments")) b.arguments.append(fn.path("arguments").asText(""));
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse OpenAI SSE chunk ({}): {}", e.getMessage(),
                        json.length() > 200 ? json.substring(0, 200) + "..." : json);
            }
        });

        if (!pendingTools.isEmpty()) {
            List<ChatMessage.ToolCall> calls = new ArrayList<>();
            for (ToolCallBuilder b : pendingTools.values()) {
                if (b.id != null && b.name != null) {
                    String args = b.arguments.length() == 0 ? "{}" : b.arguments.toString();
                    calls.add(new ChatMessage.ToolCall(b.id, b.name, args));
                }
            }
            if (!calls.isEmpty()) {
                consumer.accept(new ChatEvent.ToolCallRequest(calls));
            }
        }
        consumer.accept(new ChatEvent.Done(
                promptTokens[0],
                completionTokens[0],
                usedModel[0],
                finishReason[0],
                fullText.toString()
        ));
    }

    // ─── Request body construction ─────────────────────────────────────────

    /**
     * Visible for testing — construit le corps de requete OpenAI a partir d'un ChatRequest.
     * Ne fait pas d'appel reseau.
     */
    Map<String, Object> buildRequestBody(ChatRequest request, String model) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", request.maxTokens());
        body.put("stream", true);
        // Demande l'usage en fin de stream (OpenAI ne l'inclut pas par defaut en streaming).
        body.put("stream_options", Map.of("include_usage", true));
        if (request.temperature() >= 0) {
            body.put("temperature", request.temperature());
        }
        body.put("messages", toOpenAiMessages(request));
        if (!request.tools().isEmpty()) {
            body.put("tools", toOpenAiTools(request.tools()));
        }
        return body;
    }

    private List<Map<String, Object>> toOpenAiMessages(ChatRequest request) {
        List<Map<String, Object>> out = new ArrayList<>();

        // Le system prompt est un message role=system en tete (OpenAI n'a pas de champ
        // "system" separe). On concatene l'eventuel suffixe volatil (memoire/RAG).
        String system = request.systemPrompt();
        String suffix = request.volatileSystemSuffix();
        if (system != null && !system.isBlank()) {
            String content = (suffix != null && !suffix.isBlank()) ? system + "\n\n" + suffix : system;
            out.add(Map.of("role", "system", "content", content));
        } else if (suffix != null && !suffix.isBlank()) {
            out.add(Map.of("role", "system", "content", suffix));
        }

        for (ChatMessage m : request.messages()) {
            switch (m.role()) {
                case ChatMessage.ROLE_USER -> out.add(toUserMessage(m));
                case ChatMessage.ROLE_ASSISTANT -> out.add(toAssistantMessage(m));
                case ChatMessage.ROLE_TOOL -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("role", "tool");
                    entry.put("tool_call_id", m.toolCallId());
                    entry.put("content", m.content() != null ? m.content() : "");
                    out.add(entry);
                }
                default -> throw new IllegalArgumentException("Unsupported role: " + m.role());
            }
        }
        return out;
    }

    private Map<String, Object> toUserMessage(ChatMessage m) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("role", "user");
        if (m.attachments() != null && !m.attachments().isEmpty()) {
            List<Map<String, Object>> blocks = new ArrayList<>();
            if (m.content() != null && !m.content().isBlank()) {
                blocks.add(Map.of("type", "text", "text", m.content()));
            }
            for (MessageAttachment att : m.attachments()) {
                Map<String, Object> img = toOpenAiImageBlock(att);
                if (img != null) blocks.add(img);
            }
            if (blocks.isEmpty()) {
                entry.put("content", m.content() != null ? m.content() : "");
            } else {
                entry.put("content", blocks);
            }
        } else {
            entry.put("content", m.content() != null ? m.content() : "");
        }
        return entry;
    }

    private Map<String, Object> toAssistantMessage(ChatMessage m) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("role", "assistant");
        if (m.toolCalls() != null && !m.toolCalls().isEmpty()) {
            // content peut etre null quand l'assistant ne fait qu'appeler des outils.
            entry.put("content", m.content() != null && !m.content().isBlank() ? m.content() : null);
            List<Map<String, Object>> calls = new ArrayList<>();
            for (ChatMessage.ToolCall call : m.toolCalls()) {
                Map<String, Object> fn = new LinkedHashMap<>();
                fn.put("name", call.name());
                fn.put("arguments", call.arguments() != null ? call.arguments() : "{}");
                Map<String, Object> entryCall = new LinkedHashMap<>();
                entryCall.put("id", call.id());
                entryCall.put("type", "function");
                entryCall.put("function", fn);
                calls.add(entryCall);
            }
            entry.put("tool_calls", calls);
        } else {
            entry.put("content", m.content() != null ? m.content() : "");
        }
        return entry;
    }

    private Map<String, Object> toOpenAiImageBlock(MessageAttachment att) {
        if (att == null
                || !MessageAttachment.TYPE_IMAGE.equals(att.type())
                || att.mediaType() == null
                || att.base64Data() == null
                || att.base64Data().isBlank()) {
            log.warn("Skipping unsupported attachment (type={}, mediaType={}, hasBase64={})",
                    att == null ? null : att.type(),
                    att == null ? null : att.mediaType(),
                    att != null && att.base64Data() != null);
            return null;
        }
        String dataUrl = "data:" + att.mediaType() + ";base64," + att.base64Data();
        Map<String, Object> imageUrl = new LinkedHashMap<>();
        imageUrl.put("url", dataUrl);
        Map<String, Object> block = new LinkedHashMap<>();
        block.put("type", "image_url");
        block.put("image_url", imageUrl);
        return block;
    }

    private List<Map<String, Object>> toOpenAiTools(List<ToolDescriptor> tools) {
        List<Map<String, Object>> out = new ArrayList<>(tools.size());
        for (ToolDescriptor td : tools) {
            Map<String, Object> function = new LinkedHashMap<>();
            function.put("name", td.name());
            function.put("description", td.description());
            function.put("parameters", td.jsonSchema());
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("type", "function");
            entry.put("function", function);
            out.add(entry);
        }
        return out;
    }

    // Accumulateur mutable pour un tool_call en cours de streaming.
    private static final class ToolCallBuilder {
        String id;
        String name;
        final StringBuilder arguments = new StringBuilder();
    }
}
