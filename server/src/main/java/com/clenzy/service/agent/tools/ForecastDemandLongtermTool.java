package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.DemandForecastService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code forecast_demand_longterm} — prévision de demande LONG TERME
 * agrégée par mois pour une propriété (planification capacité/staffing). Lecture seule.
 *
 * <p>Délègue à {@link DemandForecastService}. Complémentaire de
 * {@code get_occupancy_forecast} (jour/jour, ≤ 90 j). Agent constellation : {@code rev}.</p>
 */
@Component
public class ForecastDemandLongtermTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ForecastDemandLongtermTool.class);
    private static final String NAME = "forecast_demand_longterm";
    private static final int DEFAULT_MONTHS = 6;

    private final DemandForecastService demandForecastService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ForecastDemandLongtermTool(DemandForecastService demandForecastService, ObjectMapper objectMapper) {
        this.demandForecastService = demandForecastService;
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
            if (args == null || !args.hasNonNull("propertyId")) {
                throw new ToolExecutionException(NAME, "Paramètre 'propertyId' requis.");
            }
            long propertyId = args.get("propertyId").asLong();
            int months = args.hasNonNull("months") ? args.get("months").asInt(DEFAULT_MONTHS) : DEFAULT_MONTHS;

            DemandForecastService.LongTermForecastResult result =
                    demandForecastService.forecastLongTerm(propertyId, months, context.keycloakId());
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (ToolExecutionException e) {
            throw e;
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize long-term forecast", e);
        } catch (Exception e) {
            log.warn("forecast_demand_longterm failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Prévision long terme indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriété"},
                        "months": {"type":"integer","minimum":2,"maximum":12,"description":"Horizon en mois (défaut 6, max 12)"}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "PRÉVISION de demande à LONG TERME, agrégée par mois, pour une propriété : occupation "
                            + "moyenne et confiance par mois, jours déjà réservés, saison dominante, pic et creux. "
                            + "Pour la planification de capacité, du staffing et de la trésorerie. Utiliser pour "
                            + "'prévision sur plusieurs mois', 'occupation du trimestre/de l'année', 'tendance "
                            + "long terme', 'planifier la saison'. (Pour un détail jour/jour court, voir get_occupancy_forecast.)",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
