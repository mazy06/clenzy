package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.ProactiveMaintenanceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code predict_maintenance_needs} — maintenance prédictive : logements à
 * risque (ancienneté du dernier entretien + usure/nuits-voyageurs). Lecture seule.
 *
 * <p>Délègue à {@link ProactiveMaintenanceService}. Sert le chat (« quels logements
 * ont besoin d'entretien ? ») ET les scans autonomes (suggestion de maintenance
 * préventive avant la panne / le mauvais avis). Agent constellation : {@code ops}.</p>
 */
@Component
public class PredictMaintenanceNeedsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(PredictMaintenanceNeedsTool.class);
    private static final String NAME = "predict_maintenance_needs";

    private final ProactiveMaintenanceService proactiveMaintenanceService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public PredictMaintenanceNeedsTool(ProactiveMaintenanceService proactiveMaintenanceService,
                                       ObjectMapper objectMapper) {
        this.proactiveMaintenanceService = proactiveMaintenanceService;
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
            ProactiveMaintenanceService.MaintenanceForecastResult result =
                    proactiveMaintenanceService.predict();
            return ToolResult.success(objectMapper.writeValueAsString(result), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize maintenance forecast", e);
        } catch (Exception e) {
            log.warn("predict_maintenance_needs failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Prévision de maintenance indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {},
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Identifie les logements à RISQUE de maintenance (préventif) à partir de l'ancienneté "
                            + "du dernier entretien et de l'usure (nuits-voyageurs depuis). Retourne une liste "
                            + "priorisée (HIGH/MEDIUM) avec le logement, les jours depuis le dernier entretien, "
                            + "les nuits-voyageurs et la raison. Utiliser pour 'quels logements ont besoin "
                            + "d'entretien', 'maintenance préventive', 'quel bien risque une panne', 'anticiper "
                            + "les réparations'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
