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
 * Tool {@code simulate_calendar_block} — estime la perte revenue d'un blocage calendaire.
 *
 * <p>Read-only, pas de mutation. Base le chiffrage sur l'occupancy de la meme periode
 * l'annee precedente (fallback : moyenne 6 mois).</p>
 */
@Component
public class SimulateCalendarBlockTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SimulateCalendarBlockTool.class);
    private static final String NAME = "simulate_calendar_block";

    private final SimulationService simulationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SimulateCalendarBlockTool(SimulationService simulationService,
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
        Long propertyId = args.path("propertyId").asLong();
        LocalDate from = parseDate(args.path("from").asText(null));
        LocalDate to = parseDate(args.path("to").asText(null));
        if (from == null || to == null) {
            throw new ToolExecutionException(NAME, "from et to sont requis (YYYY-MM-DD)");
        }
        if (from.isAfter(to)) {
            throw new ToolExecutionException(NAME, "'from' doit etre <= 'to'");
        }

        try {
            SimulationService.CalendarBlockResult result = simulationService.simulateCalendarBlock(
                    context.keycloakId(), propertyId, from, to);
            return ToolResult.success(objectMapper.writeValueAsString(toPayload(result)),
                    "simulation");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize simulation payload", e);
        } catch (Exception e) {
            log.warn("simulate_calendar_block failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Simulation indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toPayload(SimulationService.CalendarBlockResult r) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("kind", "calendar_block");
        payload.put("title", "Simulation blocage " + r.propertyName()
                + " (" + r.daysBlocked() + " jours)");
        payload.put("propertyId", r.propertyId());
        payload.put("propertyName", r.propertyName());
        payload.put("from", r.from().toString());
        payload.put("to", r.to().toString());
        payload.put("daysBlocked", r.daysBlocked());
        payload.put("estimatedOccupancy", round(r.estimatedOccupancy(), 4));
        payload.put("adr", round(r.adr(), 2));
        payload.put("expectedBookedNights", r.expectedBookedNights());
        payload.put("estimatedLostRevenue", r.estimatedLostRevenue()
                .setScale(2, RoundingMode.HALF_UP).doubleValue());
        payload.put("reference", r.reference());
        payload.put("alternativeSuggestions", r.alternativeSuggestions());
        return payload;
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
                        "propertyId": {"type":"integer","description":"Id de la propriete a bloquer"},
                        "from":       {"type":"string","format":"date","description":"Debut blocage inclusif (YYYY-MM-DD)"},
                        "to":         {"type":"string","format":"date","description":"Fin blocage inclusif (YYYY-MM-DD)"}
                      },
                      "required": ["propertyId","from","to"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Estime la perte de revenue projete si une plage de dates est bloquee (renovation, sejour proprio, maintenance). Base le chiffrage sur l'occupancy de la meme periode l'annee precedente. Utiliser pour 'combien je perds si je bloque', 'cout opportunite blocage'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
