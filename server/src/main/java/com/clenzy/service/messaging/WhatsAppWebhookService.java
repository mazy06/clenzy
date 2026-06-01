package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Webhook entrant <b>Meta Cloud API uniquement</b>. La structure de payload
 * (entries -> changes -> value -> messages/statuses) et la verification
 * (mode=subscribe + verify_token) sont specifiques au format Meta.
 *
 * <p>Pour OpenWA, un webhook distinct sera necessaire (format different :
 * message.received avec signature HMAC). Pour l'instant, les orgs en
 * provider=OPENWA ne recoivent PAS les messages entrants via Clenzy —
 * ils restent sur le telephone du host. C'est documenté dans l'UI de
 * configuration (mode "send-only" pour OpenWA en MVP).</p>
 *
 * <p>Le {@code markAsRead} est route via {@link WhatsAppProviderResolver}
 * pour qu'il s'execute sur le bon provider — en pratique toujours Meta
 * puisque seul Meta declenche ce webhook, mais on garde la generalisation
 * pour quand OpenWA aura son propre webhook.</p>
 */
@Service
public class WhatsAppWebhookService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookService.class);

    private final WhatsAppConfigRepository configRepository;
    private final ConversationService conversationService;
    private final WhatsAppProviderResolver providerResolver;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookService(WhatsAppConfigRepository configRepository,
                                   ConversationService conversationService,
                                   WhatsAppProviderResolver providerResolver,
                                   ObjectMapper objectMapper) {
        this.configRepository = configRepository;
        this.conversationService = conversationService;
        this.providerResolver = providerResolver;
        this.objectMapper = objectMapper;
    }

    public boolean verifyWebhook(String mode, String token, String challenge, Long orgId) {
        if (!"subscribe".equals(mode)) return false;
        return configRepository.findByOrganizationId(orgId)
            .map(config -> constantTimeEquals(token, config.getWebhookVerifyToken()))
            .orElse(false);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(
            a.getBytes(StandardCharsets.UTF_8),
            b.getBytes(StandardCharsets.UTF_8));
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

                    // Mark as read — route via le resolver pour utiliser le bon
                    // provider (toujours Meta en pratique vu que ce webhook est
                    // Meta-only, mais on garde l'abstraction pour quand OpenWA
                    // aura son propre webhook).
                    try { providerResolver.resolve(config).markAsRead(config, messageId); } catch (Exception ignored) {}
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
