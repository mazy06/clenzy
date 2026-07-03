package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.integration.channex.dto.RateParityReport;
import com.clenzy.integration.channex.service.RateParityService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Tool {@code check_rate_parity} (S2, read-only) — verifie la parite tarifaire
 * d'une propriete : prix attendu (PriceEngine local) vs prix publie sur les
 * canaux OTA via Channex, sur les prochains jours.
 *
 * <p>Delegue a {@link RateParityService} qui porte l'ownership multi-tenant
 * (la propriete doit appartenir a l'org du contexte). Aucune ecriture.</p>
 *
 * <p>Args :
 * <ul>
 *   <li>{@code propertyId} : id de la propriete (requis)</li>
 *   <li>{@code days}       : fenetre en jours (defaut 30, max 90)</li>
 * </ul>
 */
@Component
public class CheckRateParityTool implements ToolHandler {

    private static final String NAME = "check_rate_parity";

    private final RateParityService rateParityService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public CheckRateParityTool(RateParityService rateParityService, ObjectMapper objectMapper) {
        this.rateParityService = rateParityService;
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
        JsonNode propertyIdNode = args.path("propertyId");
        if (propertyIdNode.isMissingNode() || propertyIdNode.isNull()) {
            throw new ToolExecutionException(NAME, "Indique un 'propertyId'");
        }
        long propertyId = propertyIdNode.asLong();
        Integer days = args.path("days").isMissingNode() || args.path("days").isNull()
                ? null : args.path("days").asInt();

        RateParityReport report;
        try {
            report = rateParityService.checkParity(propertyId, context.organizationId(), days);
        } catch (AccessDeniedException e) {
            throw new ToolExecutionException(NAME,
                    "Propriete " + propertyId + " non accessible dans cette organisation");
        } catch (IllegalStateException e) {
            throw new ToolExecutionException(NAME, e.getMessage());
        }

        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("title", "Parite tarifaire — " + report.propertyName());
            payload.put("hasDisparity", report.hasDisparity());
            payload.set("report", objectMapper.valueToTree(report));
            return ToolResult.success(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize rate parity payload", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"Id de la propriete a verifier"},
                        "days":       {"type":"integer","minimum":1,"maximum":90,"description":"Fenetre de comparaison en jours (defaut 30, max 90)"}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Verifie la parite tarifaire d'une propriete : compare le prix attendu "
                        + "(moteur de prix Baitly) au prix publie sur les canaux OTA via Channex "
                        + "sur les prochains jours. Rapport par canal : jours en disparite, "
                        + "ecart max %, dates les plus divergentes. Lecture seule.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
