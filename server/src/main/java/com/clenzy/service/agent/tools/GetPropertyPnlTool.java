package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.PropertyPnlService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code get_property_pnl} — rentabilité NETTE par logement (revenu −
 * commission − coûts d'intervention) sur une période. Lecture seule.
 *
 * <p>Délègue à {@link PropertyPnlService}. Sert le chat (« quels logements sont
 * rentables ? ») ET les scans autonomes (suggestion « logement déficitaire à
 * revoir »). Agent constellation : {@code fin}.</p>
 */
@Component
public class GetPropertyPnlTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetPropertyPnlTool.class);
    private static final String NAME = "get_property_pnl";
    private static final int DEFAULT_MONTHS = 3;

    private final PropertyPnlService propertyPnlService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetPropertyPnlTool(PropertyPnlService propertyPnlService, ObjectMapper objectMapper) {
        this.propertyPnlService = propertyPnlService;
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
            PropertyPnlService.PnlResult result = propertyPnlService.compute(months);
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize property P&L", e);
        } catch (Exception e) {
            log.warn("get_property_pnl failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Rentabilité par logement indisponible (" + e.getMessage() + ")", e);
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
                    "Calcule la rentabilité NETTE par logement sur la période : revenu (réservations) moins "
                            + "commission canal moins coûts d'intervention (ménage/maintenance) = profit net et "
                            + "marge %. Classe les logements et signale les déficitaires. Utiliser pour 'quels "
                            + "logements sont rentables', 'rentabilité par bien', 'marge nette par logement', "
                            + "'quel bien me coûte de l'argent'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
