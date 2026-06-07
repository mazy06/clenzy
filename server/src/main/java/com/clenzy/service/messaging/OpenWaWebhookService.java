package com.clenzy.service.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Webhook ENTRANT <b>OpenWA</b> (relais guest -> host — lot B entrant OpenWA).
 *
 * <p>Format OpenWA (different de Meta) : enveloppe
 * {@code {event, timestamp, sessionId, idempotencyKey, deliveryId, data}} avec
 * {@code event = "message.received"} et un objet {@code data} contenant
 * {@code from} ("33...@c.us"), {@code body}, {@code id}, {@code fromMe},
 * {@code isGroup}.</p>
 *
 * <p>On ignore : les events != {@code message.received}, les echos de nos
 * propres envois ({@code fromMe}) et les messages de groupe ({@code isGroup} ou
 * suffixe {@code @g.us}). Le routage metier (guest / reservation / host / file
 * « a trier ») est <b>mutualise</b> avec Meta via {@link WhatsAppInboundRouter}.</p>
 *
 * <p>OpenWA ne fournit pas de nom d'expediteur fiable dans le payload, donc
 * {@code senderProfileName} est vide : le router retombe sur le numero comme
 * libelle.</p>
 */
@Service
public class OpenWaWebhookService {

    private static final Logger log = LoggerFactory.getLogger(OpenWaWebhookService.class);
    private static final String EVENT_MESSAGE_RECEIVED = "message.received";
    private static final String GROUP_SUFFIX = "@g.us";

    private final WhatsAppInboundRouter inboundRouter;
    private final ObjectMapper objectMapper;

    public OpenWaWebhookService(WhatsAppInboundRouter inboundRouter, ObjectMapper objectMapper) {
        this.inboundRouter = inboundRouter;
        this.objectMapper = objectMapper;
    }

    public void process(byte[] rawBody) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String event = root.path("event").asText("");
            if (!EVENT_MESSAGE_RECEIVED.equals(event)) {
                log.debug("Webhook OpenWA ignore (event={})", event);
                return;
            }
            JsonNode data = root.path("data");
            if (data.isMissingNode()) return;

            if (data.path("fromMe").asBoolean(false)) {
                return; // echo de nos propres envois
            }
            String from = data.path("from").asText("");
            if (data.path("isGroup").asBoolean(false) || from.endsWith(GROUP_SUFFIX)) {
                log.debug("Webhook OpenWA ignore (message de groupe: {})", from);
                return; // pas de groupe dans le relais MVP
            }

            String number = stripSuffix(from);
            if (number.isBlank()) return;
            String text = data.path("body").asText("");
            String messageId = data.path("id").asText("");

            log.info("WhatsApp (OpenWA) message recu de {}: {}", number,
                text.length() > 50 ? text.substring(0, 50) + "..." : text);

            inboundRouter.route(number, "", text, messageId);
        } catch (Exception e) {
            log.error("Erreur traitement webhook OpenWA: {}", e.getMessage());
        }
    }

    /** "33612345678@c.us" -> "33612345678". */
    private static String stripSuffix(String from) {
        if (from == null) return "";
        int at = from.indexOf('@');
        return (at > 0) ? from.substring(0, at) : from;
    }
}
