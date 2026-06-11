package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.MessageAttachment;
import com.clenzy.model.AssistantMessage;
import com.clenzy.service.PhotoStorageService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Conversion de l'historique persiste ({@link AssistantMessage}) vers le format
 * LLM ({@link ChatMessage}), resolution des attachments (refs storage → base64)
 * et serialisation des refs d'attachments a persister.
 *
 * <p>Extrait de {@code AgentOrchestrator} (refactor SRP) — comportement strictement
 * identique.</p>
 */
@Component
public class ConversationHistoryMapper {

    private static final Logger log = LoggerFactory.getLogger(ConversationHistoryMapper.class);

    private final ObjectMapper objectMapper;
    private final PhotoStorageService photoStorageService;

    public ConversationHistoryMapper(ObjectMapper objectMapper,
                                      PhotoStorageService photoStorageService) {
        this.objectMapper = objectMapper;
        this.photoStorageService = photoStorageService;
    }

    public List<ChatMessage> toChatMessages(List<AssistantMessage> history) {
        List<ChatMessage> result = new ArrayList<>();
        for (AssistantMessage m : history) {
            switch (m.getRole()) {
                case AssistantMessage.ROLE_USER -> {
                    String content = m.getContent() != null ? m.getContent() : "";
                    List<MessageAttachment> atts = resolveAttachmentsSafe(m.getAttachments());
                    if (atts.isEmpty()) {
                        result.add(ChatMessage.user(content));
                    } else {
                        result.add(ChatMessage.user(content, atts));
                    }
                }
                case AssistantMessage.ROLE_ASSISTANT -> {
                    List<ChatMessage.ToolCall> calls = parseToolCallsSafe(m.getToolCalls());
                    if (!calls.isEmpty()) {
                        result.add(ChatMessage.assistantToolCalls(calls));
                    } else {
                        result.add(ChatMessage.assistant(m.getContent() != null ? m.getContent() : ""));
                    }
                }
                case AssistantMessage.ROLE_TOOL ->
                        result.add(ChatMessage.tool(m.getToolCallId(),
                                m.getContent() != null ? m.getContent() : ""));
                default -> log.warn("Role inconnu dans l'historique : {}", m.getRole());
            }
        }
        return result;
    }

    /**
     * Serialise les {@link AttachmentRef} en JSON array a stocker dans la
     * colonne {@code attachments} de l'AssistantMessage. On garde une forme
     * resilient au schema (storageKey + mediaType minimum) pour pouvoir relire
     * meme apres une evolution du modele.
     */
    public String serializeAttachmentsSafe(List<AttachmentRef> attachments) {
        if (attachments == null || attachments.isEmpty()) return null;
        try {
            List<Map<String, Object>> list = new ArrayList<>(attachments.size());
            for (AttachmentRef ref : attachments) {
                if (ref == null || ref.storageKey() == null) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("storageKey", ref.storageKey());
                m.put("mediaType", ref.mediaType());
                if (ref.url() != null) m.put("url", ref.url());
                if (ref.name() != null) m.put("name", ref.name());
                list.add(m);
            }
            return list.isEmpty() ? null : objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize attachments : {}", e.getMessage());
            return null;
        }
    }

    /**
     * Charge les attachments persistes (JSON array de refs storage) et resout
     * chaque entree en bytes base64 via {@link PhotoStorageService}. Si une
     * resolution echoue, l'attachment est skip (warn log) — le message texte
     * passe quand meme.
     */
    private List<MessageAttachment> resolveAttachmentsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        List<MessageAttachment> out = new ArrayList<>();
        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return List.of();
            for (JsonNode node : arr) {
                String storageKey = node.path("storageKey").asText(null);
                String mediaType = node.path("mediaType").asText(null);
                if (storageKey == null || storageKey.isBlank() || mediaType == null) continue;
                try {
                    byte[] bytes = photoStorageService.retrieve(storageKey);
                    if (bytes == null || bytes.length == 0) continue;
                    String base64 = Base64.getEncoder().encodeToString(bytes);
                    out.add(MessageAttachment.imageBase64(mediaType, base64));
                } catch (Exception e) {
                    log.warn("Attachment storageKey '{}' indisponible : {}",
                            storageKey, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("attachments JSON invalide, ignored : {}", e.getMessage());
        }
        return out;
    }

    private List<ChatMessage.ToolCall> parseToolCallsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return List.of();
            List<ChatMessage.ToolCall> out = new ArrayList<>(arr.size());
            for (JsonNode node : arr) {
                String id = node.path("id").asText(null);
                String name = node.path("name").asText(null);
                String args = node.path("arguments").asText("{}");
                if (id != null && name != null) {
                    out.add(new ChatMessage.ToolCall(id, name, args));
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("Failed to parse persisted tool_calls JSON: {}", e.getMessage());
            return List.of();
        }
    }
}
