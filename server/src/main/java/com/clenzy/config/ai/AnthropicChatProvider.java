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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Stream;

/**
 * Implementation Anthropic du {@link ChatLLMProvider} : chat multi-turn,
 * streaming SSE, tool calling.
 *
 * <p>Utilise l'endpoint {@code POST /v1/messages} avec {@code stream: true}.
 * Parse les evenements SSE Anthropic :
 * <ul>
 *   <li>{@code message_start} : usage.input_tokens initial, modele utilise</li>
 *   <li>{@code content_block_start} : debut d'un bloc (type=text ou tool_use)</li>
 *   <li>{@code content_block_delta} : delta texte (text_delta) ou JSON outil (input_json_delta)</li>
 *   <li>{@code content_block_stop} : fin d'un bloc — declenche flush du tool_use accumule</li>
 *   <li>{@code message_delta} : stop_reason et usage.output_tokens final</li>
 *   <li>{@code message_stop} : fin du stream — emet {@link ChatEvent.Done}</li>
 * </ul>
 *
 * <p><b>Vision</b> : les messages utilisateur peuvent porter des
 * {@link MessageAttachment} (images base64). Ils sont convertis en content
 * blocks {@code type=image}. <b>Modele requis : Claude 3.5 Sonnet ou superieur</b>
 * (Claude 3 Haiku et anterieurs ne supportent pas la vision). Le defaut du
 * projet ({@code claude-sonnet-4-20250514}) est compatible.</p>
 *
 * <p><b>BYOK</b> : la signature avec {@code apiKey} construit un client one-shot.
 * Pas de cache, pas de log de la cle. Si {@code apiKey} est null/blank on fallback
 * sur la cle plateforme (chemin {@link #streamChat(ChatRequest, Consumer)}).</p>
 *
 * <p><b>Securite</b> : aucun message complet n'est logge. Les logs ne contiennent
 * que des metadonnees (count de messages, modele, finishReason).</p>
 */
@Component
public class AnthropicChatProvider implements ChatLLMProvider {

    private static final Logger log = LoggerFactory.getLogger(AnthropicChatProvider.class);
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(2);

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final HttpClient httpClient;

    public AnthropicChatProvider(AiProperties aiProperties,
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
        return "anthropic";
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
        AiProperties.Anthropic config = aiProperties.getAnthropic();
        doStream(request, consumer, config.getApiKey(), config.getBaseUrl());
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        AiProperties.Anthropic config = aiProperties.getAnthropic();
        String effectiveKey = (apiKey == null || apiKey.isBlank()) ? config.getApiKey() : apiKey;
        doStream(request, consumer, effectiveKey, config.getBaseUrl());
    }

    // ─── Core streaming logic ──────────────────────────────────────────────

    private void doStream(ChatRequest request, Consumer<ChatEvent> consumer,
                          String apiKey, String baseUrl) {
        // Court-circuit si aucune cle dispo : evite un 401 cryptique cote Anthropic
        // et renvoie un message clair au frontend pour guider l'admin.
        if (apiKey == null || apiKey.isBlank()) {
            consumer.accept(new ChatEvent.Error(
                    "Aucune cle API Anthropic configuree. Configure ANTHROPIC_API_KEY "
                            + "(variable d'environnement) ou ajoute une cle BYOK pour ton "
                            + "organisation dans Settings > IA.", null));
            return;
        }

        String model = request.model() != null ? request.model() : aiProperties.getAnthropic().getModel();
        String body;
        try {
            body = objectMapper.writeValueAsString(buildRequestBody(request, model));
        } catch (JsonProcessingException e) {
            consumer.accept(new ChatEvent.Error("Failed to serialize request: " + e.getMessage(), e));
            return;
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/messages"))
                .timeout(REQUEST_TIMEOUT)
                .header("x-api-key", apiKey)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .header("content-type", "application/json")
                .header("accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        log.debug("anthropic.streamChat model={} messages={} tools={}",
                model, request.messages().size(), request.tools().size());

        try {
            HttpResponse<Stream<String>> response = httpClient.send(
                    httpRequest, HttpResponse.BodyHandlers.ofLines());

            if (response.statusCode() == 410) {
                // Modele EOL — replique le comportement de AnthropicProvider
                String responseBody = response.body().reduce("", (a, b) -> a + b);
                log.warn("Anthropic API: modele '{}' obsolete (410 Gone). Reponse: {}", model, responseBody);
                if (eventPublisher != null) {
                    eventPublisher.publishEvent(new AiModelDeprecatedEvent("anthropic", model, responseBody));
                }
                consumer.accept(new ChatEvent.Error(
                        "Le modele '" + model + "' n'est plus disponible chez anthropic. "
                                + "Selectionnez un nouveau modele dans Parametres > IA et sauvegardez.",
                        null));
                return;
            }

            if (response.statusCode() >= 400) {
                String responseBody = response.body().reduce("", (a, b) -> a + b);
                log.error("Anthropic API call failed: status={} body={}", response.statusCode(), responseBody);
                consumer.accept(new ChatEvent.Error(
                        "Anthropic API returned status " + response.statusCode(), null));
                return;
            }

            parseStream(response.body(), model, consumer);
        } catch (Exception e) {
            log.error("Anthropic streamChat failed: {}", e.getMessage());
            consumer.accept(new ChatEvent.Error("Anthropic streamChat failed: " + e.getMessage(), e));
        }
    }

    // ─── SSE parsing ──────────────────────────────────────────────────────

    /**
     * Visible for testing — parse un flux SSE Anthropic et emet les ChatEvent
     * correspondants. Ne fait pas d'appel reseau.
     */
    void parseStream(Stream<String> lines, String modelHint, Consumer<ChatEvent> consumer) {
        StringBuilder fullText = new StringBuilder();
        List<ChatMessage.ToolCall> toolCalls = new ArrayList<>();

        // Track in-progress tool_use blocks by content block index
        Map<Integer, ToolUseBuilder> pendingTools = new HashMap<>();

        int[] promptTokens = {0};
        int[] completionTokens = {0};
        String[] finishReason = {null};
        String[] usedModel = {modelHint};

        lines.forEach(line -> {
            if (line == null || line.isEmpty()) return;
            if (!line.startsWith("data:")) return;
            String json = line.substring(5).trim();
            if (json.isEmpty()) return;

            try {
                JsonNode event = objectMapper.readTree(json);
                String type = event.path("type").asText("");

                switch (type) {
                    case "message_start" -> {
                        JsonNode message = event.path("message");
                        if (message.has("model")) usedModel[0] = message.path("model").asText(modelHint);
                        JsonNode usage = message.path("usage");
                        if (usage.has("input_tokens")) {
                            promptTokens[0] = usage.path("input_tokens").asInt(0);
                        }
                    }
                    case "content_block_start" -> {
                        int index = event.path("index").asInt(-1);
                        JsonNode block = event.path("content_block");
                        String blockType = block.path("type").asText("");
                        if ("tool_use".equals(blockType)) {
                            ToolUseBuilder b = new ToolUseBuilder();
                            b.id = block.path("id").asText(null);
                            b.name = block.path("name").asText(null);
                            b.jsonBuffer = new StringBuilder();
                            pendingTools.put(index, b);
                        }
                    }
                    case "content_block_delta" -> {
                        int index = event.path("index").asInt(-1);
                        JsonNode delta = event.path("delta");
                        String deltaType = delta.path("type").asText("");
                        if ("text_delta".equals(deltaType)) {
                            String text = delta.path("text").asText("");
                            if (!text.isEmpty()) {
                                fullText.append(text);
                                consumer.accept(new ChatEvent.TextDelta(text));
                            }
                        } else if ("input_json_delta".equals(deltaType)) {
                            ToolUseBuilder b = pendingTools.get(index);
                            if (b != null) {
                                b.jsonBuffer.append(delta.path("partial_json").asText(""));
                            }
                        }
                    }
                    case "content_block_stop" -> {
                        int index = event.path("index").asInt(-1);
                        ToolUseBuilder b = pendingTools.remove(index);
                        if (b != null && b.id != null && b.name != null) {
                            // partial JSON can be empty if the tool takes no args — default to "{}"
                            String args = b.jsonBuffer.length() == 0 ? "{}" : b.jsonBuffer.toString();
                            toolCalls.add(new ChatMessage.ToolCall(b.id, b.name, args));
                        }
                    }
                    case "message_delta" -> {
                        JsonNode delta = event.path("delta");
                        if (delta.has("stop_reason")) {
                            finishReason[0] = delta.path("stop_reason").asText(null);
                        }
                        JsonNode usage = event.path("usage");
                        if (usage.has("output_tokens")) {
                            completionTokens[0] = usage.path("output_tokens").asInt(0);
                        }
                    }
                    case "message_stop" -> {
                        // handled after the stream is fully consumed
                    }
                    case "error" -> {
                        JsonNode err = event.path("error");
                        String message = err.path("message").asText("Unknown Anthropic error");
                        consumer.accept(new ChatEvent.Error("Anthropic stream error: " + message, null));
                    }
                    default -> {
                        // ping, unknown events: ignore
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse Anthropic SSE event ({}): {}", e.getMessage(),
                        json.length() > 200 ? json.substring(0, 200) + "..." : json);
            }
        });

        if (!toolCalls.isEmpty()) {
            consumer.accept(new ChatEvent.ToolCallRequest(toolCalls));
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
     * Visible for testing — construit le corps de requete Anthropic a partir d'un ChatRequest.
     * Ne fait pas d'appel reseau.
     */
    Map<String, Object> buildRequestBody(ChatRequest request, String model) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", request.maxTokens());
        body.put("stream", true);
        if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
            body.put("system", request.systemPrompt());
        }
        if (request.temperature() >= 0) {
            body.put("temperature", request.temperature());
        }

        body.put("messages", toAnthropicMessages(request.messages()));

        if (!request.tools().isEmpty()) {
            body.put("tools", toAnthropicTools(request.tools()));
        }
        return body;
    }

    private List<Map<String, Object>> toAnthropicMessages(List<ChatMessage> messages) {
        List<Map<String, Object>> out = new ArrayList<>(messages.size());
        for (ChatMessage m : messages) {
            Map<String, Object> entry = new LinkedHashMap<>();
            switch (m.role()) {
                case ChatMessage.ROLE_USER -> {
                    entry.put("role", "user");
                    // Si le message porte des attachments image, on doit emettre un
                    // content sous forme de liste de blocks : un block image par
                    // attachment puis un block text. Sinon, content reste un simple
                    // string (compat retro).
                    if (m.attachments() != null && !m.attachments().isEmpty()) {
                        List<Map<String, Object>> blocks = new ArrayList<>();
                        for (MessageAttachment att : m.attachments()) {
                            Map<String, Object> imgBlock = toAnthropicImageBlock(att);
                            if (imgBlock != null) blocks.add(imgBlock);
                        }
                        // Le block texte vient APRES les images (recommandation Anthropic
                        // pour que le modele "voie" l'image avant d'interpreter la consigne).
                        if (m.content() != null && !m.content().isBlank()) {
                            blocks.add(Map.of("type", "text", "text", m.content()));
                        }
                        // Si aucun block n'a pu etre cree (toutes les images invalides),
                        // on retombe sur le content texte pour ne pas envoyer une liste vide.
                        if (blocks.isEmpty()) {
                            entry.put("content", m.content() != null ? m.content() : "");
                        } else {
                            entry.put("content", blocks);
                        }
                    } else {
                        entry.put("content", m.content() != null ? m.content() : "");
                    }
                }
                case ChatMessage.ROLE_ASSISTANT -> {
                    entry.put("role", "assistant");
                    if (m.toolCalls() != null && !m.toolCalls().isEmpty()) {
                        // Reconstruct assistant content as list of blocks (text + tool_use)
                        List<Map<String, Object>> blocks = new ArrayList<>();
                        if (m.content() != null && !m.content().isBlank()) {
                            blocks.add(Map.of("type", "text", "text", m.content()));
                        }
                        for (ChatMessage.ToolCall call : m.toolCalls()) {
                            Map<String, Object> block = new LinkedHashMap<>();
                            block.put("type", "tool_use");
                            block.put("id", call.id());
                            block.put("name", call.name());
                            // input must be a JSON object — parse the stored arguments string
                            block.put("input", parseJsonObjectSafe(call.arguments()));
                            blocks.add(block);
                        }
                        entry.put("content", blocks);
                    } else {
                        entry.put("content", m.content() != null ? m.content() : "");
                    }
                }
                case ChatMessage.ROLE_TOOL -> {
                    // Anthropic models tool results as user message with tool_result block
                    entry.put("role", "user");
                    Map<String, Object> block = new LinkedHashMap<>();
                    block.put("type", "tool_result");
                    block.put("tool_use_id", m.toolCallId());
                    block.put("content", m.content() != null ? m.content() : "");
                    entry.put("content", List.of(block));
                }
                default -> throw new IllegalArgumentException("Unsupported role: " + m.role());
            }
            out.add(entry);
        }
        return out;
    }

    /**
     * Convertit un {@link MessageAttachment} en content block Anthropic
     * {@code type=image} avec source base64. Retourne null si l'attachment
     * n'est pas exploitable (type non IMAGE, mediaType absent, pas de
     * base64Data — le provider attend que le caller ait deja resolu le
     * storageKey en base64 via {@code PhotoStorageService.retrieve}).
     *
     * <p>Anthropic accepte les formats {@code image/jpeg}, {@code image/png},
     * {@code image/gif}, {@code image/webp}. Limite 5MB par image. Le
     * filtrage MIME est fait en amont a l'upload — ici on log un warn et
     * on skip si le mediaType est inconnu pour eviter une erreur 400.</p>
     */
    private Map<String, Object> toAnthropicImageBlock(MessageAttachment att) {
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
        if (!isSupportedImageMediaType(att.mediaType())) {
            log.warn("Skipping image with unsupported mediaType '{}'", att.mediaType());
            return null;
        }
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("type", "base64");
        source.put("media_type", att.mediaType());
        source.put("data", att.base64Data());

        Map<String, Object> block = new LinkedHashMap<>();
        block.put("type", "image");
        block.put("source", source);
        return block;
    }

    private static boolean isSupportedImageMediaType(String mediaType) {
        return "image/jpeg".equalsIgnoreCase(mediaType)
                || "image/png".equalsIgnoreCase(mediaType)
                || "image/gif".equalsIgnoreCase(mediaType)
                || "image/webp".equalsIgnoreCase(mediaType);
    }

    private List<Map<String, Object>> toAnthropicTools(List<ToolDescriptor> tools) {
        List<Map<String, Object>> out = new ArrayList<>(tools.size());
        for (ToolDescriptor td : tools) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", td.name());
            entry.put("description", td.description());
            entry.put("input_schema", td.jsonSchema());
            out.add(entry);
        }
        return out;
    }

    private Object parseJsonObjectSafe(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.warn("Failed to parse tool_use input JSON, sending empty object: {}", e.getMessage());
            return Map.of();
        }
    }

    // Mutable accumulator for tool_use blocks in flight
    private static final class ToolUseBuilder {
        String id;
        String name;
        StringBuilder jsonBuffer = new StringBuilder();
    }
}
