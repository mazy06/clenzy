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

    /**
     * Remplace les images des anciens messages user (T-04, levier vision) :
     * l'analyse du modele est deja dans l'historique, re-envoyer le base64
     * (~4k tokens/image + fetch storage) a chaque tour est du gaspillage pur.
     */
    static final String PAST_IMAGE_PLACEHOLDER =
            "[Image jointe a ce message — deja analysee, voir la reponse qui suit]";

    public List<ChatMessage> toChatMessages(List<AssistantMessage> history) {
        List<AssistantMessage> window = windowed(history);
        if (window == null) {
            return new ArrayList<>();
        }
        // Seul le DERNIER message user garde ses images (c'est le tour courant :
        // le modele doit pouvoir les regarder). Les plus anciens recoivent un
        // placeholder textuel — leur analyse est deja dans l'historique.
        int lastUserIdx = -1;
        for (int i = window.size() - 1; i >= 0; i--) {
            if (AssistantMessage.ROLE_USER.equals(window.get(i).getRole())) {
                lastUserIdx = i;
                break;
            }
        }
        List<ChatMessage> result = new ArrayList<>();
        for (int i = 0; i < window.size(); i++) {
            AssistantMessage m = window.get(i);
            switch (m.getRole()) {
                case AssistantMessage.ROLE_USER -> {
                    String content = m.getContent() != null ? m.getContent() : "";
                    boolean hasAttachments = m.getAttachments() != null && !m.getAttachments().isBlank();
                    if (hasAttachments && i == lastUserIdx) {
                        List<MessageAttachment> atts = resolveAttachmentsSafe(m.getAttachments());
                        result.add(atts.isEmpty()
                                ? ChatMessage.user(content)
                                : ChatMessage.user(content, atts));
                    } else if (hasAttachments) {
                        result.add(ChatMessage.user(content.isBlank()
                                ? PAST_IMAGE_PLACEHOLDER
                                : content + "\n" + PAST_IMAGE_PLACEHOLDER));
                    } else {
                        result.add(ChatMessage.user(content));
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
                                ContextBudget.capToolResult(m.getContent())));
                default -> log.warn("Role inconnu dans l'historique : {}", m.getRole());
            }
        }
        return result;
    }

    /**
     * Fenêtre glissante d'historique (lever #2) : ne garde que les
     * {@link ContextBudget#MAX_HISTORY_MESSAGES} messages les plus récents, en
     * préservant l'intégrité tool_use/tool_result.
     *
     * <p>Après découpe, on élague les {@code ROLE_TOOL} en TÊTE de fenêtre : leur
     * message assistant (tool_call) serait hors fenêtre → {@code tool_result} orphelin
     * = requête invalide côté Anthropic/OpenAI. La queue (tour user courant) est
     * toujours conservée.</p>
     */
    private List<AssistantMessage> windowed(List<AssistantMessage> history) {
        if (history == null || history.size() <= ContextBudget.MAX_HISTORY_MESSAGES) {
            return history;
        }
        int start = history.size() - ContextBudget.MAX_HISTORY_MESSAGES;
        while (start < history.size()
                && AssistantMessage.ROLE_TOOL.equals(history.get(start).getRole())) {
            start++;
        }
        // Garde-fou : si la fenêtre ne contenait QUE des ROLE_TOOL (cas quasi-impossible
        // en flux nominal), l'élagage viderait la liste → requête LLM sans message (400).
        // On retombe sur la fenêtre brute (le provider tolère mieux un tool_result de tête
        // qu'une liste vide).
        if (start >= history.size()) {
            return history.subList(history.size() - ContextBudget.MAX_HISTORY_MESSAGES, history.size());
        }
        log.debug("Historique tronqué : {} messages → fenêtre de {} (depuis l'index {})",
                history.size(), history.size() - start, start);
        return history.subList(start, history.size());
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
                // SECURITE (audit 2026-06, A1-AGENT-IA-01) : le storageKey est
                // controle par le client (refs re-injectees dans le body chat).
                // On valide l'appartenance a l'org du caller AVANT de resoudre les
                // bytes — sinon lecture de fichier arbitraire cross-org (le storage
                // local resout par property_photos.id, enumerable cross-org).
                // L'AccessDeniedException remonte (pas avalee) : un attachment force
                // est une tentative d'acces, pas une indisponibilite transitoire.
                try {
                    photoStorageService.assertReadableInCurrentOrg(storageKey);
                } catch (org.springframework.security.access.AccessDeniedException e) {
                    log.warn("Attachment storageKey '{}' refuse (acces cross-organisation) : {}",
                            storageKey, e.getMessage());
                    throw e;
                }
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
        } catch (org.springframework.security.access.AccessDeniedException e) {
            // Tentative d'acces cross-org sur un attachment force : remonter,
            // ne PAS confondre avec un JSON invalide (catch generique ci-dessous).
            throw e;
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
