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
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tool {@code get_interventions_by_status} — distribution des interventions
 * par statut sur une periode.
 *
 * <p>Retourne un payload {@code chart_pie} compatible avec le widget frontend
 * {@code PieChartWidget} — meme format que les charts du module /reports
 * ({@code ChartDataItem[]}).</p>
 *
 * <p>Wraps {@link InterventionService#listWithRoleBasedAccess(...)} avec un
 * pageSize eleve (500) + agregation en memoire. Pour des volumes plus gros,
 * une query d'agregation native serait preferable (optimisation future).</p>
 */
@Component
public class GetInterventionsByStatusTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetInterventionsByStatusTool.class);
    private static final String NAME = "get_interventions_by_status";
    private static final int AGGREGATION_PAGE_SIZE = 500;

    private final InterventionService interventionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetInterventionsByStatusTool(InterventionService interventionService, ObjectMapper objectMapper) {
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
            throw new ToolExecutionException(NAME, "JWT requis (role-based filtering)");
        }

        Long propertyId = args.hasNonNull("propertyId") ? args.path("propertyId").asLong() : null;
        String type = optString(args, "type");
        String from = optString(args, "from");
        String to = optString(args, "to");

        try {
            Page<InterventionResponse> page = interventionService.listWithRoleBasedAccess(
                    PageRequest.of(0, AGGREGATION_PAGE_SIZE),
                    propertyId, type, null, null, from, to, context.jwt());

            // Agregation : count par status (groupBy)
            Map<String, Long> byStatus = page.getContent().stream()
                    .filter(r -> r.status() != null)
                    .collect(Collectors.groupingBy(InterventionResponse::status, Collectors.counting()));

            // Convertir en ChartDataItem[] tri par valeur DESC
            List<Map<String, Object>> items = byStatus.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .map(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("name", e.getKey());
                        m.put("value", e.getValue());
                        return m;
                    })
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("title", "Interventions par statut");
            payload.put("centerLabel", "interventions");
            payload.put("totalCount", page.getTotalElements());

            return ToolResult.success(objectMapper.writeValueAsString(payload), "chart_pie");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_interventions_by_status failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Aggregation indisponible (" + e.getMessage() + ")", e);
        }
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
                        "propertyId": {"type":"integer","description":"Filtre sur une propriete (optionnel)"},
                        "type":       {"type":"string","description":"Filtre par type d'intervention (HOUSEKEEPING, MAINTENANCE, etc.)"},
                        "from":       {"type":"string","format":"date","description":"Date debut (YYYY-MM-DD)"},
                        "to":         {"type":"string","format":"date","description":"Date fin (YYYY-MM-DD)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Affiche un graphique camembert (pie chart) de la distribution des interventions par statut (PENDING / IN_PROGRESS / COMPLETED / CANCELLED / ...) sur une periode donnee. Utiliser pour 'distribution', 'repartition', 'breakdown' des interventions, ou pour analyser la performance operationnelle.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
