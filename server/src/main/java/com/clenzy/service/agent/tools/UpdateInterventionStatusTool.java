package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.InterventionLifecycleService;
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
 * Tool {@code update_intervention_status} — change le statut d'une intervention
 * (menage / maintenance) : IN_PROGRESS, COMPLETED, CANCELLED, etc.
 *
 * <p>requiresConfirmation = true — action d'ecriture, gatee par confirmation HITL.</p>
 *
 * <p>Delegue ENTIEREMENT a {@link InterventionLifecycleService#updateStatus} qui
 * porte la machine a etats ({@code InterventionStatus.canTransitionTo}), la
 * verification d'acces (InterventionAccessPolicy), la transaction et les
 * notifications. Le tool ne reimplemente aucune regle metier.</p>
 *
 * <p>Specialist suggere : operations.</p>
 */
@Component
public class UpdateInterventionStatusTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(UpdateInterventionStatusTool.class);
    private static final String NAME = "update_intervention_status";

    private final InterventionLifecycleService interventionLifecycleService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public UpdateInterventionStatusTool(InterventionLifecycleService interventionLifecycleService,
                                        ObjectMapper objectMapper) {
        this.interventionLifecycleService = interventionLifecycleService;
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
        if (!args.hasNonNull("interventionId")) {
            throw new ToolExecutionException(NAME, "interventionId est requis");
        }
        if (!args.hasNonNull("status") || args.path("status").asText().isBlank()) {
            throw new ToolExecutionException(NAME, "status est requis");
        }
        Long interventionId = args.path("interventionId").asLong();
        // InterventionStatus.fromString est insensible a la casse cote service.
        String status = args.path("status").asText().trim();

        try {
            InterventionResponse updated =
                    interventionLifecycleService.updateStatus(interventionId, status, context.jwt());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", updated.id());
            if (updated.title() != null) {
                payload.put("title", updated.title());
            }
            if (updated.propertyName() != null) {
                payload.put("propertyName", updated.propertyName());
            }
            payload.put("newStatus", updated.status());
            payload.put("message", "Intervention #" + interventionId + " : statut mis a jour vers " + updated.status() + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("update_intervention_status failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Mise a jour du statut impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "interventionId": {"type":"integer","description":"REQUIS : ID de l'intervention"},
                        "status": {"type":"string","enum":["PENDING","AWAITING_VALIDATION","AWAITING_PAYMENT","IN_PROGRESS","COMPLETED","CANCELLED"],"description":"REQUIS : nouveau statut. Les transitions sont validees par le service (ex: IN_PROGRESS->COMPLETED). CANCELLED reserve aux admins/managers."}
                      },
                      "required": ["interventionId","status"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Change le statut d'une intervention (menage/maintenance) : IN_PROGRESS, COMPLETED, CANCELLED. Transitions invalides rejetees. Confirmer obligatoirement.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
