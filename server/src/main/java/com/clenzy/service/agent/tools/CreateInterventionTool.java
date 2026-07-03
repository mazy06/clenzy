package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
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
 * Tool {@code create_intervention} — cree une intervention (menage / maintenance / etc.)
 * sur une propriete.
 *
 * <p>requiresConfirmation = true. L'orchestrateur demande au user de valider
 * via le dialog avant execution.</p>
 *
 * <p>Le {@code requestorId} est resolu automatiquement depuis le user
 * authentifie (lookup par keycloak_id).</p>
 */
@Component
public class CreateInterventionTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(CreateInterventionTool.class);
    private static final String NAME = "create_intervention";
    private static final int DEFAULT_DURATION_HOURS = 2;

    private final InterventionService interventionService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public CreateInterventionTool(InterventionService interventionService,
                                   UserRepository userRepository,
                                   ObjectMapper objectMapper) {
        this.interventionService = interventionService;
        this.userRepository = userRepository;
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
        Long propertyId = requireLong(args, "propertyId");
        String title = requireString(args, "title");
        String type = requireString(args, "type");
        String scheduledDate = requireString(args, "scheduledDate");
        String description = args.path("description").asText(null);
        String priority = args.path("priority").asText("MEDIUM");
        int duration = args.path("estimatedDurationHours").asInt(DEFAULT_DURATION_HOURS);

        // Resolve requestorId from authenticated user
        User requestor = userRepository.findByKeycloakId(context.keycloakId())
                .orElseThrow(() -> new ToolExecutionException(NAME,
                        "Utilisateur introuvable en BDD (keycloakId=" + context.keycloakId() + ")"));

        try {
            CreateInterventionRequest request = new CreateInterventionRequest(
                    title, description, type, priority,
                    propertyId, requestor.getId(), scheduledDate,
                    duration, null, null);

            InterventionResponse created = interventionService.create(request, context.jwt());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", created.id());
            payload.put("title", created.title());
            payload.put("type", created.type());
            payload.put("status", created.status());
            payload.put("propertyId", created.propertyId());
            payload.put("propertyName", created.propertyName());
            payload.put("scheduledDate", created.scheduledDate());
            payload.put("message", "Intervention #" + created.id() + " creee avec succes.");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("create_intervention failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Creation impossible (" + e.getMessage() + ")", e);
        }
    }

    private static Long requireLong(JsonNode args, String key) {
        if (!args.hasNonNull(key)) {
            throw new ToolExecutionException(NAME, key + " est requis");
        }
        return args.path(key).asLong();
    }

    private static String requireString(JsonNode args, String key) {
        if (!args.hasNonNull(key)) {
            throw new ToolExecutionException(NAME, key + " est requis");
        }
        String s = args.path(key).asText("");
        if (s.isBlank()) {
            throw new ToolExecutionException(NAME, key + " ne peut pas etre vide");
        }
        return s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId":              {"type":"integer","description":"REQUIS : ID de la propriete"},
                        "title":                   {"type":"string","minLength":5,"maxLength":100,"description":"REQUIS : Titre court de l'intervention"},
                        "type":                    {"type":"string","enum":["HOUSEKEEPING","MAINTENANCE","CHECK_IN","CHECK_OUT","LAUNDRY","INSPECTION","OTHER"],"description":"REQUIS : Type d'intervention"},
                        "scheduledDate":           {"type":"string","format":"date","description":"REQUIS : Date prevue (YYYY-MM-DD)"},
                        "description":             {"type":"string","maxLength":500,"description":"Description detaillee (optionnel)"},
                        "priority":                {"type":"string","enum":["LOW","MEDIUM","HIGH","URGENT"],"description":"Priorite (defaut MEDIUM)"},
                        "estimatedDurationHours":  {"type":"integer","minimum":1,"description":"Duree estimee en heures (defaut 2)"}
                      },
                      "required": ["propertyId","title","type","scheduledDate"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Cree une intervention (menage, maintenance, check-in/out) sur une propriete. Requestor = utilisateur connecte. Confirmer avant d'executer.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
