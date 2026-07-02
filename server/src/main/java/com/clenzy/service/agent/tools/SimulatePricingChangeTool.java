package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.SimulationService;
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

import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code simulate_pricing_change} — projection what-if d'un changement de prix.
 *
 * <p>Read-only (pas de mutation cote BDD), {@code requiresConfirmation = false}. La
 * simulation est purement analytique : elle eclaire la decision, ne l'applique pas.</p>
 *
 * <p>Args :
 * <ul>
 *   <li>{@code propertyId} (requis) : propriete cible</li>
 *   <li>{@code pctChange} (requis) : variation en % (-50..+50). Ex: -10 = baisse 10%.</li>
 *   <li>{@code from}, {@code to} : fenetre simulee (par defaut : 30 prochains jours)</li>
 * </ul>
 */
@Component
public class SimulatePricingChangeTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SimulatePricingChangeTool.class);
    private static final String NAME = "simulate_pricing_change";
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final SimulationService simulationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SimulatePricingChangeTool(SimulationService simulationService,
                                       ObjectMapper objectMapper) {
        this.simulationService = simulationService;
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
        if (!args.has("propertyId") || args.path("propertyId").isNull()) {
            throw new ToolExecutionException(NAME, "propertyId est requis");
        }
        if (!args.has("pctChange") || args.path("pctChange").isNull()) {
            throw new ToolExecutionException(NAME, "pctChange est requis (ex: -10 pour -10%)");
        }
        Long propertyId = args.path("propertyId").asLong();
        double pctChangeRaw = args.path("pctChange").asDouble();
        if (pctChangeRaw < -50 || pctChangeRaw > 50) {
            throw new ToolExecutionException(NAME,
                    "pctChange doit etre compris entre -50 et +50 (% de variation)");
        }
        // L'API publique accepte un entier "10" pour 10%. On normalise vers une fraction.
        double pctChange = pctChangeRaw / 100.0;

        LocalDate from = parseDate(args.path("from").asText(null));
        LocalDate to = parseDate(args.path("to").asText(null));
        if (from == null) from = LocalDate.now();
        if (to == null) to = from.plusDays(DEFAULT_WINDOW_DAYS);
        if (from.isAfter(to)) {
            throw new ToolExecutionException(NAME, "'from' doit etre <= 'to'");
        }

        try {
            SimulationService.PricingChangeResult result = simulationService.simulatePricingChange(
                    context.keycloakId(), propertyId, pctChange, from, to);

            return ToolResult.success(objectMapper.writeValueAsString(toPayload(result)),
                    "simulation");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize simulation payload", e);
        } catch (Exception e) {
            log.warn("simulate_pricing_change failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Simulation indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toPayload(SimulationService.PricingChangeResult r) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("kind", "pricing_change");
        payload.put("title", "Simulation pricing " + r.propertyName()
                + " (" + formatPctSigned(r.pctChange()) + ")");
        payload.put("propertyId", r.propertyId());
        payload.put("propertyName", r.propertyName());
        payload.put("pctChange", round(r.pctChange(), 4));
        payload.put("elasticity", r.elasticity());
        payload.put("elasticitySource", r.elasticitySource());
        payload.put("from", r.from().toString());
        payload.put("to", r.to().toString());
        payload.put("simulationDays", r.simulationDays());
        payload.put("baseline", toScenario("Baseline", r.baseline()));
        payload.put("scenario", toScenario("Scenario", r.scenario()));
        payload.put("deltaRevenue", r.deltaRevenue()
                .setScale(2, RoundingMode.HALF_UP).doubleValue());
        payload.put("deltaOccupancy", round(r.deltaOccupancy(), 4));
        payload.put("pctRevenueChange", round(r.pctRevenueChange(), 4));
        payload.put("recommendation", r.recommendation());
        return payload;
    }

    private Map<String, Object> toScenario(String label, SimulationService.Scenario s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("adr", round(s.adr(), 2));
        m.put("occupancyRate", round(s.occupancyRate(), 4));
        m.put("bookedNights", s.bookedNights());
        m.put("revenue", s.revenue().setScale(2, RoundingMode.HALF_UP).doubleValue());
        return m;
    }

    private static String formatPctSigned(double frac) {
        double pct = frac * 100;
        return (pct > 0 ? "+" : "") + Math.round(pct) + "%";
    }

    private static double round(double v, int decimals) {
        return java.math.BigDecimal.valueOf(v)
                .setScale(decimals, RoundingMode.HALF_UP).doubleValue();
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw); }
        catch (Exception e) {
            throw new ToolExecutionException(NAME, "Date invalide : '" + raw + "' (YYYY-MM-DD)");
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"Id de la propriete cible"},
                        "pctChange":  {"type":"number","minimum":-50,"maximum":50,"description":"Variation prix en %. Ex: -10 = baisse 10%, +15 = hausse 15%"},
                        "from":       {"type":"string","format":"date","description":"Debut fenetre simulee (defaut aujourd'hui)"},
                        "to":         {"type":"string","format":"date","description":"Fin fenetre simulee (defaut +30j)"}
                      },
                      "required": ["propertyId","pctChange"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Simule l'impact d'un changement de prix sur le revenue projete (elasticite 0.5) : baseline vs scenario, delta, reco. Pour 'si je baisse de X%'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
