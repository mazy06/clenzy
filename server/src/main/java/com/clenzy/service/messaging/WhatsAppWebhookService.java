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
 * <p>OpenWA a desormais son propre webhook entrant
 * ({@link OpenWaWebhookService}, format {@code message.received} + signature
 * HMAC {@code X-OpenWA-Signature}). Les deux partagent le meme routage metier
 * via {@link WhatsAppInboundRouter} (guest / reservation / host / file a trier).</p>
 *
 * <p>Le {@code markAsRead} est route via {@link WhatsAppProviderResolver}
 * pour qu'il s'execute sur le bon provider — en pratique toujours Meta
 * puisque seul ce webhook (Meta) le declenche.</p>
 */
@Service
public class WhatsAppWebhookService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookService.class);

    private final WhatsAppConfigRepository configRepository;
    private final WhatsAppInboundRouter inboundRouter;
    private final WhatsAppProviderResolver providerResolver;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookService(WhatsAppConfigRepository configRepository,
                                   WhatsAppInboundRouter inboundRouter,
                                   WhatsAppProviderResolver providerResolver,
                                   ObjectMapper objectMapper) {
        this.configRepository = configRepository;
        this.inboundRouter = inboundRouter;
        this.providerResolver = providerResolver;
        this.objectMapper = objectMapper;
    }

    public boolean verifyWebhook(String mode, String token, String challenge) {
        if (!"subscribe".equals(mode)) return false;
        // Compte WhatsApp GLOBAL : un seul webhook_verify_token (config singleton).
        return configRepository.findFirstByOrganizationIdIsNull()
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

        // Compte WhatsApp GLOBAL : une seule config (le numero central Baitly).
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull().orElse(null);
        if (config == null) return;

        for (JsonNode msg : messages) {
            String from = msg.path("from").asText();
            String messageId = msg.path("id").asText();
            String text = msg.path("text").path("body").asText("");
            JsonNode contacts = value.path("contacts");
            final String senderName = (contacts.isArray() && !contacts.isEmpty())
                ? contacts.get(0).path("profile").path("name").asText("")
                : "";

            log.info("WhatsApp message recu de {} ({}): {}", senderName, from,
                text.length() > 50 ? text.substring(0, 50) + "..." : text);

            // Relais : identifie le guest par son numero, rattache la conversation a
            // la reservation/host (ou file "a trier" si numero inconnu).
            try {
                inboundRouter.route(from, senderName, text, messageId);
            } catch (Exception e) {
                log.error("Echec routage message WhatsApp entrant de {}: {}", from, e.getMessage());
            }

            // Accuse reception cote Meta.
            try { providerResolver.resolve(config).markAsRead(config, messageId); } catch (Exception ignored) {}
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
