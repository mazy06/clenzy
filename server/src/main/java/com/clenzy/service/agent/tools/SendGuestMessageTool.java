package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code send_guest_message} — envoie un message a un guest via un
 * template (welcome, check-in instructions, review request, etc.).
 *
 * <p>requiresConfirmation = true — envoi reel d'email/SMS au guest.</p>
 */
@Component
public class SendGuestMessageTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SendGuestMessageTool.class);
    private static final String NAME = "send_guest_message";

    private final GuestMessagingService guestMessagingService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SendGuestMessageTool(GuestMessagingService guestMessagingService, ObjectMapper objectMapper) {
        this.guestMessagingService = guestMessagingService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        if (!args.hasNonNull("reservationId") || !args.hasNonNull("templateId")) {
            throw new ToolExecutionException(NAME, "reservationId et templateId sont requis");
        }
        Long reservationId = args.path("reservationId").asLong();
        Long templateId = args.path("templateId").asLong();

        try {
            GuestMessageLog sent = guestMessagingService.sendMessage(
                    reservationId, templateId, context.organizationId());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("logId", sent.getId());
            payload.put("reservationId", reservationId);
            payload.put("templateId", templateId);
            payload.put("status", sent.getStatus() != null ? sent.getStatus().name() : null);
            payload.put("channel", sent.getChannel() != null ? sent.getChannel().name() : null);
            payload.put("message", "Message envoye au guest avec succes.");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("send_guest_message failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Envoi impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"REQUIS : ID de la reservation"},
                        "templateId":    {"type":"integer","description":"REQUIS : ID du template de message"}
                      },
                      "required": ["reservationId","templateId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Envoie un message au guest d'une reservation via template (welcome, check-in...). Canal email/SMS/WhatsApp selon template. Confirmer avant envoi reel.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
