package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PropertyService;
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
 * Tool {@code update_property_status} — change le statut d'une propriete
 * (ACTIVE / INACTIVE / UNDER_MAINTENANCE / ARCHIVED).
 *
 * <p>requiresConfirmation = true. Particulierement critique pour ARCHIVED
 * qui rend la propriete invisible dans la plupart des listes.</p>
 */
@Component
public class UpdatePropertyStatusTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(UpdatePropertyStatusTool.class);
    private static final String NAME = "update_property_status";

    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public UpdatePropertyStatusTool(PropertyService propertyService, ObjectMapper objectMapper) {
        this.propertyService = propertyService;
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
        if (!args.hasNonNull("propertyId") || !args.hasNonNull("status")) {
            throw new ToolExecutionException(NAME, "propertyId et status sont requis");
        }
        Long propertyId = args.path("propertyId").asLong();
        String status = args.path("status").asText();

        try {
            PropertyDto updated = propertyService.updateStatus(propertyId, status);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", updated.id);
            payload.put("name", updated.name);
            payload.put("newStatus", updated.status != null ? updated.status.name() : null);
            payload.put("message", "Propriete '" + updated.name + "' → " + status + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME,
                    "Statut invalide : '" + status + "' — valeurs : ACTIVE, INACTIVE, UNDER_MAINTENANCE, ARCHIVED");
        } catch (Exception e) {
            log.warn("update_property_status failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Mise a jour impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete"},
                        "status":     {"type":"string","enum":["ACTIVE","INACTIVE","UNDER_MAINTENANCE","ARCHIVED"],"description":"REQUIS : Nouveau statut"}
                      },
                      "required": ["propertyId","status"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Change le statut d'une propriete : ACTIVE, INACTIVE (cachee), UNDER_MAINTENANCE, ARCHIVED. Confirmer obligatoirement.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
