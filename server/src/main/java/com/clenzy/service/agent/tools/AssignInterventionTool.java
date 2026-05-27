package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.InterventionService;
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
 * Tool {@code assign_intervention} — assigne une intervention a un user OU
 * une team. Exactement un des deux doit etre fourni.
 *
 * <p>requiresConfirmation = true.</p>
 */
@Component
public class AssignInterventionTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(AssignInterventionTool.class);
    private static final String NAME = "assign_intervention";

    private final InterventionService interventionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public AssignInterventionTool(InterventionService interventionService, ObjectMapper objectMapper) {
        this.interventionService = interventionService;
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
        if (context.jwt() == null) {
            throw new ToolExecutionException(NAME, "JWT requis");
        }
        Long interventionId = requireLong(args, "interventionId");
        Long userId = args.hasNonNull("userId") ? args.path("userId").asLong() : null;
        Long teamId = args.hasNonNull("teamId") ? args.path("teamId").asLong() : null;

        if (userId == null && teamId == null) {
            throw new ToolExecutionException(NAME, "userId OU teamId requis (un des deux)");
        }
        if (userId != null && teamId != null) {
            throw new ToolExecutionException(NAME, "userId ET teamId fournis — choisir un seul");
        }

        try {
            InterventionResponse updated = interventionService.assign(
                    interventionId, userId, teamId, context.jwt());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", updated.id());
            payload.put("title", updated.title());
            payload.put("status", updated.status());
            payload.put("assignedToName", updated.assignedToName());
            payload.put("assignedToType", updated.assignedToType());
            payload.put("message", "Intervention #" + updated.id() + " assignee a "
                    + updated.assignedToName() + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("assign_intervention failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Assignation impossible (" + e.getMessage() + ")", e);
        }
    }

    private static Long requireLong(JsonNode args, String key) {
        if (!args.hasNonNull(key)) {
            throw new ToolExecutionException(NAME, key + " est requis");
        }
        return args.path(key).asLong();
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "interventionId": {"type":"integer","description":"REQUIS : ID de l'intervention"},
                        "userId":          {"type":"integer","description":"ID du user assigne (exclusif avec teamId)"},
                        "teamId":          {"type":"integer","description":"ID de la team assignee (exclusif avec userId)"}
                      },
                      "required": ["interventionId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Assigne une intervention a un utilisateur ou a une equipe. Confirmer avant d'executer. Fournir userId OU teamId (pas les deux).",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
