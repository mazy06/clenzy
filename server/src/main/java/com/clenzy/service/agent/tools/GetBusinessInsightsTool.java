package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.AiInsightDto;
import com.clenzy.service.AiAnalyticsService;
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
import java.util.List;
import java.util.Map;

/**
 * Tool {@code get_business_insights} — insights strategiques generes par
 * {@link AiAnalyticsService#getAiInsights}.
 *
 * <p>Retourne une liste de {@link AiInsightDto} avec type/severity/title/
 * description/recommendation — exactement ce que le widget {@code InsightsWidget}
 * du module /reports affiche. Le LLM peut alors interpreter chaque insight et
 * formuler une strategie avec l'utilisateur.</p>
 *
 * <p><b>Requis</b> : {@code propertyId} (les insights sont calcules par propriete).
 * Si non fourni, le tool retourne une erreur exploitable par le LLM pour
 * proposer un {@code list_properties} prealable.</p>
 */
@Component
public class GetBusinessInsightsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetBusinessInsightsTool.class);
    private static final String NAME = "get_business_insights";
    private static final int DEFAULT_DAYS_BACK = 90;

    private final AiAnalyticsService aiAnalyticsService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetBusinessInsightsTool(AiAnalyticsService aiAnalyticsService, ObjectMapper objectMapper) {
        this.aiAnalyticsService = aiAnalyticsService;
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
            throw new ToolExecutionException(NAME,
                    "propertyId est requis. Si l'utilisateur n'a pas precise, appelle d'abord list_properties pour lui proposer un choix.");
        }
        Long propertyId = args.path("propertyId").asLong();
        int daysBack = Math.max(7, Math.min(365, args.path("daysBack").asInt(DEFAULT_DAYS_BACK)));

        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(daysBack);

        try {
            List<AiInsightDto> insights = aiAnalyticsService.getAiInsights(
                    propertyId, context.organizationId(), from, to);

            // Mapper les DTO en payload JSON pour le frontend (InsightsWidget)
            List<Map<String, Object>> items = insights.stream()
                    .map(this::mapInsight)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("propertyId", propertyId);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("title", "Insights strategiques (" + daysBack + " derniers jours)");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "insights");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_business_insights failed: {}", e.getMessage());
            // Erreur exploitee par le LLM : si feature AI desactivee, il pourra
            // suggerer a l'utilisateur d'activer analyticsAi dans Settings.
            throw new ToolExecutionException(NAME,
                    "Insights AI indisponibles (" + e.getMessage()
                            + "). Verifier que l'IA Analytics est activee dans Parametres > IA.", e);
        }
    }

    private Map<String, Object> mapInsight(AiInsightDto i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", i.type());                 // ANOMALY | TREND | RECOMMENDATION | WARNING
        m.put("severity", i.severity());          // LOW | MEDIUM | HIGH | CRITICAL
        m.put("title", i.title());
        m.put("description", i.description());
        if (i.recommendation() != null && !i.recommendation().isBlank()) {
            m.put("recommendation", i.recommendation());
        }
        return m;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete a analyser"},
                        "daysBack":   {"type":"integer","minimum":7,"maximum":365,"description":"Fenetre d'analyse en jours retroactifs (defaut 90)"}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Insights strategiques IA d'une propriete : anomalies, tendances, recommandations, warnings (severite). Pour 'conseils', 'que dois-je faire', 'analyse ma perf'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
