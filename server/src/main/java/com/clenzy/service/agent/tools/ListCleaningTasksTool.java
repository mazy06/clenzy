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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code list_cleaning_tasks} — interventions de type HOUSEKEEPING.
 *
 * <p>Wraps {@link InterventionService#listWithRoleBasedAccess(...)} avec
 * {@code type="HOUSEKEEPING"} fixe. Filtres : {@code propertyId}, {@code status},
 * {@code from}/{@code to} (dates), {@code limit}.</p>
 *
 * <p>Necessite que {@link AgentContext#jwt()} ne soit pas null — le service
 * fait du role-based filtering. Si le JWT manque, on retourne une erreur claire
 * plutot que de bypass la securite.</p>
 */
@Component
public class ListCleaningTasksTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListCleaningTasksTool.class);
    private static final String NAME = "list_cleaning_tasks";
    private static final String INTERVENTION_TYPE_HOUSEKEEPING = "HOUSEKEEPING";
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final InterventionService interventionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListCleaningTasksTool(InterventionService interventionService, ObjectMapper objectMapper) {
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
            throw new ToolExecutionException(NAME,
                    "JWT requis pour le filtrage role-based (context.jwt est null)");
        }

        Long propertyId = args.hasNonNull("propertyId") ? args.path("propertyId").asLong() : null;
        String status = optString(args, "status");
        String priority = optString(args, "priority");
        String startDate = optString(args, "from");
        String endDate = optString(args, "to");
        int limit = Math.min(MAX_LIMIT, Math.max(1, args.path("limit").asInt(DEFAULT_LIMIT)));

        try {
            Page<InterventionResponse> page = interventionService.listWithRoleBasedAccess(
                    PageRequest.of(0, limit, Sort.by("scheduledDate").ascending()),
                    propertyId,
                    INTERVENTION_TYPE_HOUSEKEEPING,
                    status,
                    priority,
                    startDate,
                    endDate,
                    context.jwt());

            List<Map<String, Object>> items = page.getContent().stream()
                    .map(this::compact)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalElements", page.getTotalElements());
            payload.put("truncated", page.getTotalElements() > items.size());

            String json = objectMapper.writeValueAsString(payload);
            return ToolResult.success(json, "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize cleaning tasks", e);
        } catch (Exception e) {
            log.warn("list_cleaning_tasks: lookup failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Liste menages indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> compact(InterventionResponse r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.id());
        if (r.title() != null) m.put("title", r.title());
        if (r.status() != null) m.put("status", r.status());
        if (r.priority() != null) m.put("priority", r.priority());
        if (r.propertyId() != null) {
            m.put("propertyId", r.propertyId());
            m.put("propertyName", r.propertyName());
        }
        if (r.scheduledDate() != null) m.put("scheduledDate", r.scheduledDate());
        if (r.assignedToName() != null) {
            m.put("assignedTo", r.assignedToName());
            if (r.assignedUserRole() != null) m.put("assignedRole", r.assignedUserRole());
        }
        if (r.progressPercentage() != null) m.put("progress", r.progressPercentage());
        return m;
    }

    private static String optString(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("");
        return s.isBlank() ? null : s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"Filtre sur une propriete"},
                        "status":     {"type":"string","description":"Filtre par statut (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)"},
                        "priority":   {"type":"string","description":"Filtre par priorite (LOW, MEDIUM, HIGH, URGENT)"},
                        "from":       {"type":"string","format":"date","description":"Date debut (ISO YYYY-MM-DD)"},
                        "to":         {"type":"string","format":"date","description":"Date fin (ISO YYYY-MM-DD)"},
                        "limit":      {"type":"integer","minimum":1,"maximum":50,"description":"Nombre max d'items (defaut 20)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les taches de menage (interventions HOUSEKEEPING), filtres propriete/statut/priorite/dates. Pour 'menages prevus', 'menages en retard'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
