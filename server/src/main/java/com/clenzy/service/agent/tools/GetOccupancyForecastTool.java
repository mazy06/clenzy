package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.model.Reservation;
import com.clenzy.service.AiAnalyticsService;
import com.clenzy.service.ReservationService;
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
 * Tool {@code get_occupancy_forecast} — prevision d'occupation sur N jours
 * pour une propriete.
 *
 * <p>Wraps {@link AiAnalyticsService#getForecast(Long, LocalDate, LocalDate, List)}.
 * Historique : on charge les reservations des 6 derniers mois via
 * {@link ReservationService} pour nourrir l'algo de prediction.</p>
 *
 * <p>Display hint {@code chart_line} : la courbe represente l'occupation
 * predite par date (0.0 = vide, 1.0 = plein), avec une serie {@code confidence}
 * complementaire pour visualiser l'incertitude.</p>
 */
@Component
public class GetOccupancyForecastTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetOccupancyForecastTool.class);
    private static final String NAME = "get_occupancy_forecast";
    private static final int DEFAULT_FORECAST_DAYS = 30;
    private static final int MAX_FORECAST_DAYS = 90;
    private static final int HISTORICAL_MONTHS_BACK = 6;

    private final AiAnalyticsService aiAnalyticsService;
    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetOccupancyForecastTool(AiAnalyticsService aiAnalyticsService,
                                     ReservationService reservationService,
                                     ObjectMapper objectMapper) {
        this.aiAnalyticsService = aiAnalyticsService;
        this.reservationService = reservationService;
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
        Long propertyId = args.path("propertyId").asLong();
        int days = Math.max(7, Math.min(MAX_FORECAST_DAYS, args.path("days").asInt(DEFAULT_FORECAST_DAYS)));

        LocalDate today = LocalDate.now();
        LocalDate forecastFrom = today;
        LocalDate forecastTo = today.plusDays(days - 1L);

        // Historique : 6 mois en arriere depuis aujourd'hui
        LocalDate historyFrom = today.minusMonths(HISTORICAL_MONTHS_BACK);

        try {
            List<Reservation> historical = reservationService.getReservations(
                    context.keycloakId(), List.of(propertyId), historyFrom, today);

            List<OccupancyForecastDto> forecast = aiAnalyticsService.getForecast(
                    propertyId, forecastFrom, forecastTo, historical);

            // Transformer en items pour LineChartWidget : name=date courte, value=occupation %
            List<Map<String, Object>> items = forecast.stream()
                    .map(this::mapForecast)
                    .toList();

            // Compter les insights remarquables (jours a haute occupation predite, low confidence)
            long highOccupancy = forecast.stream()
                    .filter(f -> f.predictedOccupancy() >= 0.85)
                    .count();
            long lowConfidence = forecast.stream()
                    .filter(f -> f.confidence() < 0.5)
                    .count();
            long alreadyBooked = forecast.stream()
                    .filter(OccupancyForecastDto::isBooked)
                    .count();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("series", List.of(
                    Map.of("key", "occupancy", "label", "Occupation %", "color", "#6B8A9A"),
                    Map.of("key", "confidence", "label", "Confiance %", "color", "#7BA3C2")
            ));
            payload.put("title", "Prevision d'occupation (" + days + " jours)");
            payload.put("daysCount", days);
            payload.put("alreadyBookedDays", alreadyBooked);
            payload.put("highOccupancyDays", highOccupancy);
            payload.put("lowConfidenceDays", lowConfidence);

            return ToolResult.success(objectMapper.writeValueAsString(payload), "chart_line");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_occupancy_forecast failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Prevision indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> mapForecast(OccupancyForecastDto f) {
        Map<String, Object> m = new LinkedHashMap<>();
        // Format JJ/MM (compact pour 30 points sur l'axe X)
        m.put("name", String.format("%02d/%02d", f.date().getDayOfMonth(), f.date().getMonthValue()));
        m.put("occupancy", Math.round(f.predictedOccupancy() * 100));
        m.put("confidence", Math.round(f.confidence() * 100));
        return m;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete"},
                        "days":       {"type":"integer","minimum":7,"maximum":90,"description":"Nombre de jours a predire en avant (defaut 30, max 90)"}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "PREVISION (forecast) d'occupation d'une propriete sur les N prochains jours (defaut 30). Base sur saisonnalite, type de jour (weekend/weekday/holiday), et historique. Series : occupation % + confiance %. Utiliser pour 'prevision', 'quelle occupation aurai-je', 'previsionnel', 'forecast', 'futur', 'a venir'. Inclut stats : jours haute occupation, jours basse confiance, jours deja bookes.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
