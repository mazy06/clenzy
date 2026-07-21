package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.MarketPositioningDto;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.marketdata.MarketPositioningService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code benchmark_market} — positionne un bien face au marché de sa zone à
 * partir des benchmarks persistés ({@code market_data_snapshots}). Remplace
 * l'ancien {@code benchmark_competition} (supprimé avec PriceLabs) : lit désormais
 * de vrais benchmarks (first-party / open data / Airbtics / AirROI), avec
 * provenance et confiance. Read-only, ne modifie aucun prix.
 */
@Component
public class BenchmarkMarketTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(BenchmarkMarketTool.class);
    private static final String NAME = "benchmark_market";

    private final MarketPositioningService positioningService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public BenchmarkMarketTool(MarketPositioningService positioningService, ObjectMapper objectMapper) {
        this.positioningService = positioningService;
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
                    "propertyId est requis. Si l'utilisateur n'a pas precise, appelle d'abord list_properties.");
        }
        final Long propertyId = args.path("propertyId").asLong();
        try {
            final MarketPositioningDto p = positioningService.position(propertyId, context.organizationId());
            final Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("area", p.area());
            payload.put("positioning", p.positioning());
            payload.put("propertyAdr", p.propertyAdr());
            payload.put("marketAdr", p.marketAdr());
            payload.put("deltaPct", p.deltaPct());
            payload.put("propertyOccupancyPct", p.propertyOccupancyPct());
            payload.put("marketOccupancyPct", p.marketOccupancyPct());
            payload.put("currency", p.currency());
            payload.put("source", p.source());
            payload.put("confidence", p.confidence());
            payload.put("headline", p.headline());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("benchmark_market failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Positionnement marché indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            final JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete"}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Positionne un logement face au marche de sa zone (prix publie vs ADR marche, "
                            + "occupation) avec provenance et confiance de la donnee. Pour "
                            + "'suis-je au bon prix', 'positionnement marche', 'benchmark'.",
                    schema);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
