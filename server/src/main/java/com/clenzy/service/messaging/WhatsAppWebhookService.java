package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class WhatsAppWebhookService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookService.class);

    private final WhatsAppConfigRepository configRepository;
    private final ConversationService conversationService;
    private final WhatsAppApiService apiService;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookService(WhatsAppConfigRepository configRepository,
                                   ConversationService conversationService,
                                   WhatsAppApiService apiService,
                                   ObjectMapper objectMapper) {
        this.configRepository = configRepository;
        this.conversationService = conversationService;
        this.apiService = apiService;
        this.objectMapper = objectMapper;
    }

    public boolean verifyWebhook(String mode, String token, String challenge, Long orgId) {
        if (!"subscribe".equals(mode)) return false;
        return configRepository.findByOrganizationId(orgId)
            .map(config -> token != null && token.equals(config.getWebhookVerifyToken()))
            .orElse(false);
    }

    public void processWebhook(Map<String, Object> payload) {
        try {
            JsonNode root = objectMapper.valueToTree(payload);
            JsonNode entries = root.path("entry");
            if (!entries.isArray()) return;

            for (JsonNode entry : entries) {
                JsonNode changes = entry.path("changes");
                if (!changes.isArray()) continue;

                for (JsonNode change : changes) {
                    JsonNode value = change.path("value");
                    if (value.isMissingNode()) continue;

                    processMessages(value);
                    processStatuses(value);
                }
            }
        } catch (Exception e) {
            log.error("Erreur traitement webhook WhatsApp: {}", e.getMessage());
        }
    }

    private void processMessages(JsonNode value) {
        JsonNode messages = value.path("messages");
        if (!messages.isArray()) return;

        String phoneNumberId = value.path("metadata").path("phone_number_id").asText(null);
        if (phoneNumberId == null) return;

        for (JsonNode msg : messages) {
            String from = msg.path("from").asText();
            String messageId = msg.path("id").asText();
            String type = msg.path("type").asText();
            String text = msg.path("text").path("body").asText("");
            JsonNode contacts = value.path("contacts");
            final String senderName = (contacts.isArray() && !contacts.isEmpty())
                ? contacts.get(0).path("profile").path("name").asText("")
                : "";

            log.info("WhatsApp message recu de {} ({}): {}", senderName, from,
                text.length() > 50 ? text.substring(0, 50) + "..." : text);

            // Trouver l'org par phoneNumberId
            configRepository.findAll().stream()
                .filter(c -> phoneNumberId.equals(c.getPhoneNumberId()))
                .findFirst()
                .ifPresent(config -> {
                    Conversation conv = conversationService.getOrCreate(
                        config.getOrganizationId(), ConversationChannel.WHATSAPP,
                        from, null, null, null, "WhatsApp: " + senderName);

                    conversationService.addInboundMessage(conv, senderName, from, text, null, messageId);

                    // Mark as read
                    try { apiService.markAsRead(config, messageId); } catch (Exception ignored) {}
                });
        }
    }

    private void processStatuses(JsonNode value) {
        JsonNode statuses = value.path("statuses");
        if (!statuses.isArray()) return;

        for (JsonNode status : statuses) {
            String statusStr = status.path("status").asText();
            String messageId = status.path("id").asText();
            log.debug("WhatsApp status update: {} -> {}", messageId, statusStr);
        }
    }
}
