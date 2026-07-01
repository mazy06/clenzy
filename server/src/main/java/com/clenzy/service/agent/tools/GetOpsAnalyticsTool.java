package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.OpsAnalyticsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code get_ops_analytics} — analytique des opérations : coûts (par type /
 * logement), taux de complétion, SLA « à temps », retards, durée moyenne. Lecture seule.
 *
 * <p>Délègue à {@link OpsAnalyticsService}. Sert le chat (« combien me coûtent mes
 * opérations ? ») ET les scans autonomes. Agent constellation : {@code ops}.</p>
 */
@Component
public class GetOpsAnalyticsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetOpsAnalyticsTool.class);
    private static final String NAME = "get_ops_analytics";
    private static final int DEFAULT_MONTHS = 3;

    private final OpsAnalyticsService opsAnalyticsService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetOpsAnalyticsTool(OpsAnalyticsService opsAnalyticsService, ObjectMapper objectMapper) {
        this.opsAnalyticsService = opsAnalyticsService;
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
        try {
            int months = args != null && args.hasNonNull("months")
                    ? args.get("months").asInt(DEFAULT_MONTHS)
                    : DEFAULT_MONTHS;
            OpsAnalyticsService.OpsAnalyticsResult result = opsAnalyticsService.analyze(months);
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize ops analytics", e);
        } catch (Exception e) {
            log.warn("get_ops_analytics failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Analytique des opérations indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "months": {
                          "type": "integer",
                          "description": "Nombre de mois d'historique (défaut 3, max 24)."
                        }
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Analytique des opérations sur la période : coût total et par type (ménage/maintenance), "
                            + "coût par logement (les plus coûteux), taux de complétion, taux « à temps » (SLA), "
                            + "interventions en retard, durée moyenne. Utiliser pour 'combien me coûtent mes "
                            + "opérations', 'coût du ménage par logement', 'mes interventions sont-elles à temps', "
                            + "'SLA opérationnel', 'quel bien me coûte le plus en entretien'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
