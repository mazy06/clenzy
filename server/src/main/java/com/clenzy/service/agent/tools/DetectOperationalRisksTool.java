package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.OpsRiskService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code detect_operational_risks} — détection PROACTIVE d'anomalies
 * opérationnelles à fenêtre courte (arrivée sans ménage, intervention en retard,
 * synchronisation canal en retard). Lecture seule.
 *
 * <p>Délègue à {@link OpsRiskService} (filtre multi-tenant côté service). Sert le
 * chat (« quels risques sur mes opérations cette semaine ? ») ET les scans
 * autonomes de la constellation, qui en tirent des suggestions actionnables.</p>
 */
@Component
public class DetectOperationalRisksTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(DetectOperationalRisksTool.class);
    private static final String NAME = "detect_operational_risks";
    private static final int DEFAULT_WINDOW_DAYS = 3;

    private final OpsRiskService opsRiskService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public DetectOperationalRisksTool(OpsRiskService opsRiskService, ObjectMapper objectMapper) {
        this.opsRiskService = opsRiskService;
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
            int windowDays = args != null && args.hasNonNull("windowDays")
                    ? args.get("windowDays").asInt(DEFAULT_WINDOW_DAYS)
                    : DEFAULT_WINDOW_DAYS;

            List<OpsRiskService.OperationalRisk> risks = opsRiskService.detectRisks(windowDays);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("risks", risks);
            payload.put("count", risks.size());
            payload.put("windowDays", Math.max(1, Math.min(windowDays, 30)));
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize operational risks", e);
        } catch (Exception e) {
            log.warn("detect_operational_risks failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Détection des risques opérationnels indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "windowDays": {
                          "type": "integer",
                          "description": "Fenêtre d'anticipation en jours (défaut 3, max 30)."
                        }
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Détecte de façon proactive les risques opérationnels à venir pour l'organisation : "
                            + "arrivée voyageur sans ménage prévu, intervention en retard, synchronisation de "
                            + "canal en retard de plus de 24h. Retourne une liste priorisée (severity HIGH/MEDIUM) "
                            + "avec, pour chaque risque, le logement, la réservation concernée et l'action "
                            + "recommandée. Utiliser pour 'quels risques sur mes opérations', 'qu'est-ce qui "
                            + "risque de mal se passer cette semaine', 'ménages manquants', 'interventions en retard'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
