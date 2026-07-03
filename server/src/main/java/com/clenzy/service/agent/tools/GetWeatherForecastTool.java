package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
import com.clenzy.integration.openmeteo.OpenMeteoClient;
import com.clenzy.service.PropertyService;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Tool {@code get_weather_forecast} — prevision meteo 1..7 jours pour une ville.
 *
 * <p>Source : Open-Meteo (https://open-meteo.com/), API gratuite sans cle.
 * Cache Redis 1h via {@link OpenMeteoClient}.</p>
 *
 * <p>Args (au moins l'un de city/propertyId requis) :
 * <ul>
 *   <li>{@code city}       : nom de ville</li>
 *   <li>{@code propertyId} : id de propriete → resolution via PropertyService.getById().city</li>
 *   <li>{@code days}       : nombre de jours (defaut 5, max 7)</li>
 * </ul>
 */
@Component
public class GetWeatherForecastTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetWeatherForecastTool.class);
    private static final String NAME = "get_weather_forecast";
    private static final int DEFAULT_DAYS = 5;
    private static final int MAX_DAYS = 7;

    private final OpenMeteoClient openMeteoClient;
    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetWeatherForecastTool(OpenMeteoClient openMeteoClient,
                                    PropertyService propertyService,
                                    ObjectMapper objectMapper) {
        this.openMeteoClient = openMeteoClient;
        this.propertyService = propertyService;
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
        String city = optString(args, "city");
        Long propertyId = args.path("propertyId").isMissingNode() || args.path("propertyId").isNull()
                ? null : args.path("propertyId").asLong();
        int days = Math.min(MAX_DAYS, Math.max(1, args.path("days").asInt(DEFAULT_DAYS)));

        // Resolution city : argument > propriete
        if ((city == null || city.isBlank()) && propertyId != null) {
            try {
                PropertyDto p = propertyService.getById(propertyId);
                if (p != null) {
                    city = p.city;
                }
            } catch (Exception e) {
                throw new ToolExecutionException(NAME,
                        "Propriete " + propertyId + " introuvable", e);
            }
        }

        if (city == null || city.isBlank()) {
            throw new ToolExecutionException(NAME,
                    "Indique une 'city' ou un 'propertyId' avec une ville renseignee");
        }

        Optional<OpenMeteoClient.GeoCoord> coord = openMeteoClient.geocode(city);
        if (coord.isEmpty()) {
            throw new ToolExecutionException(NAME,
                    "Geocoding impossible pour '" + city + "' — verifie l'orthographe");
        }

        Optional<OpenMeteoClient.ForecastSnapshot> snapshot =
                openMeteoClient.forecast(coord.get(), days);
        if (snapshot.isEmpty()) {
            throw new ToolExecutionException(NAME,
                    "Service meteo indisponible — reessaie dans quelques minutes");
        }

        try {
            return ToolResult.success(buildPayload(coord.get(), snapshot.get(), days),
                    "weather");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize weather payload", e);
        } catch (Exception e) {
            log.warn("get_weather_forecast failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Prevision meteo indisponible (" + e.getMessage() + ")", e);
        }
    }

    private String buildPayload(OpenMeteoClient.GeoCoord coord,
                                  OpenMeteoClient.ForecastSnapshot snapshot,
                                  int days) throws JsonProcessingException {
        List<Map<String, Object>> items = snapshot.items().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", d.date().toString());
            m.put("tempMax", round1(d.tempMax()));
            m.put("tempMin", round1(d.tempMin()));
            m.put("rain_mm", round1(d.precipitationMm()));
            m.put("conditionCode", d.weatherCode());
            m.put("conditionLabel", labelFromCode(d.weatherCode()));
            return m;
        }).toList();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", "Meteo " + coord.resolvedName() + " (" + items.size() + " jours)");
        payload.put("city", coord.resolvedName());
        if (coord.countryCode() != null) payload.put("countryCode", coord.countryCode());
        payload.put("days", days);
        payload.put("items", items);
        // Flag stale : visible par le LLM qui peut le mentionner a l'user
        // ("attention, donnees meteo cachees, pas tout fraiches").
        payload.put("stale", snapshot.stale());
        return objectMapper.writeValueAsString(payload);
    }

    /**
     * Mapping WMO weather code → label francais court. Cf.
     * https://open-meteo.com/en/docs (table "Weather variable documentation").
     */
    static String labelFromCode(Integer code) {
        if (code == null) return "Indisponible";
        return switch (code) {
            case 0 -> "Ensoleille";
            case 1, 2 -> "Partiellement nuageux";
            case 3 -> "Couvert";
            case 45, 48 -> "Brouillard";
            case 51, 53, 55 -> "Bruine";
            case 56, 57 -> "Bruine verglacante";
            case 61, 63, 65 -> "Pluie";
            case 66, 67 -> "Pluie verglacante";
            case 71, 73, 75 -> "Neige";
            case 77 -> "Grains de neige";
            case 80, 81, 82 -> "Averses";
            case 85, 86 -> "Averses de neige";
            case 95 -> "Orage";
            case 96, 99 -> "Orage avec grele";
            default -> "Inconnu";
        };
    }

    private static Double round1(Double v) {
        if (v == null) return null;
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static String optString(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("");
        return s.isBlank() ? null : s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "city":       {"type":"string","description":"Nom de la ville (ex: Paris, Lyon, Marrakech)"},
                        "propertyId": {"type":"integer","description":"Id de propriete : utilise sa ville si city est absent"},
                        "days":       {"type":"integer","minimum":1,"maximum":7,"description":"Nombre de jours de prevision (defaut 5, max 7)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Previsions meteo jour par jour (1-7 jours) pour une ville ou la ville d'une propriete (Open-Meteo). Pour contextualiser des recos pricing/promo last-minute.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
