package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.integration.channel.ChannelSyncService;
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

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code trigger_channel_sync} — pousse manuellement le calendrier d'une
 * propriete vers tous ses canaux connectes (campagne X7, agent Distribution).
 *
 * <p>requiresConfirmation = true au depart : c'est un mutateur vers les OTAs.
 * C'est un candidat naturel aux Regles de Confiance (X2) — apres N resyncs
 * confirmes, le systeme proposera de le passer en « notifier ».</p>
 *
 * <p>Tenant-safety : {@code ChannelSyncService.syncProperty} filtre les mappings
 * par (propertyId, orgId) — une propriete hors org n'a aucun mapping visible.</p>
 */
@Component
public class TriggerChannelSyncTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(TriggerChannelSyncTool.class);
    private static final String NAME = "trigger_channel_sync";
    /** Plage par defaut poussee aux canaux : aujourd'hui → +365 j (peu de couts, connecteurs bornent). */
    private static final int DEFAULT_RANGE_DAYS = 365;

    private final ChannelSyncService channelSyncService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public TriggerChannelSyncTool(ChannelSyncService channelSyncService, ObjectMapper objectMapper) {
        this.channelSyncService = channelSyncService;
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
        if (!args.hasNonNull("propertyId")) {
            throw new ToolExecutionException(NAME, "propertyId est requis");
        }
        Long propertyId = args.path("propertyId").asLong();
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusDays(DEFAULT_RANGE_DAYS);

        try {
            var results = channelSyncService.syncProperty(
                    propertyId, from, to, context.organizationId());
            if (results.isEmpty()) {
                throw new ToolExecutionException(NAME,
                        "Aucun canal connecte pour cette propriete (ou propriete inconnue).");
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            results.forEach((channel, result) -> payload.put(channel.name(), result.getStatus().name()));
            payload.put("message", "Synchronisation declenchee vers " + results.size() + " canal/canaux.");
            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (ToolExecutionException e) {
            throw e;
        } catch (Exception e) {
            log.warn("trigger_channel_sync failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Synchronisation impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete a resynchroniser"}
                      },
                      "required": ["propertyId"]
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Pousse le calendrier d'une propriete vers tous ses canaux (Airbnb, iCal...). Pour 'resynchronise', 'force la synchro'. Confirmation requise.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
