package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.LocalEventsRegistry;
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
 * Tool {@code get_local_events} — evenements locaux (jours feries, festivals,
 * salons, evenements sportifs) sur une plage de dates pour une ville donnee.
 *
 * <p>Source : dataset statique {@code resources/data/local_events.json}. Pas de
 * cache supplementaire necessaire — le registre garde tout en memoire.</p>
 *
 * <p>Args :
 * <ul>
 *   <li>{@code city} (requis) : nom de la ville (insensible casse)</li>
 *   <li>{@code from}, {@code to} : plage de dates inclusive (ISO YYYY-MM-DD).
 *       Par defaut : aujourd'hui → +90 jours.</li>
 * </ul>
 */
@Component
public class GetLocalEventsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetLocalEventsTool.class);
    private static final String NAME = "get_local_events";
    private static final int DEFAULT_RANGE_DAYS = 90;
    private static final int MAX_ITEMS = 50;

    private final LocalEventsRegistry registry;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetLocalEventsTool(LocalEventsRegistry registry, ObjectMapper objectMapper) {
        this.registry = registry;
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
        if (city == null) {
            throw new ToolExecutionException(NAME, "Le parametre 'city' est requis");
        }
        String country = optString(args, "country");

        LocalDate from = parseDate(args.path("from").asText(null));
        LocalDate to = parseDate(args.path("to").asText(null));

        // Defaults : aujourd'hui → +90 jours
        if (from == null) from = LocalDate.now();
        if (to == null) to = from.plusDays(DEFAULT_RANGE_DAYS);
        if (from.isAfter(to)) {
            throw new ToolExecutionException(NAME, "'from' doit etre anterieur ou egal a 'to'");
        }

        try {
            // Si country est fourni, le registry agrege les jours feries officiels
            // depuis date.nager.at. Sinon, juste le dataset YAML statique.
            List<LocalEventsRegistry.LocalEvent> matches =
                    registry.findByCityAndDateRange(city, country, from, to);

            // Truncate pour ne pas inonder le contexte LLM
            boolean truncated = matches.size() > MAX_ITEMS;
            List<LocalEventsRegistry.LocalEvent> shown = truncated
                    ? matches.subList(0, MAX_ITEMS)
                    : matches;

            List<Map<String, Object>> items = shown.stream().map(this::toItem).toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", "Evenements " + city + " (" + from + " → " + to + ")");
            payload.put("city", city);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalElements", matches.size());
            payload.put("truncated", truncated);

            return ToolResult.success(objectMapper.writeValueAsString(payload), "events");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize events payload", e);
        } catch (Exception e) {
            log.warn("get_local_events failed for city='{}': {}", city, e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Evenements indisponibles (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toItem(LocalEventsRegistry.LocalEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.id);
        m.put("title", e.title);
        m.put("type", e.type);
        m.put("date", e.date.toString());
        if (e.city != null) m.put("city", e.city);
        if (e.country != null) m.put("country", e.country);
        if (e.description != null) m.put("description", e.description);
        return m;
    }

    private static String optString(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("");
        return s.isBlank() ? null : s.trim();
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw); }
        catch (Exception e) { throw new ToolExecutionException(NAME, "Date invalide : '" + raw + "' (attendu YYYY-MM-DD)"); }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "city":    {"type":"string","description":"Nom de la ville (ex: Paris, Lyon, Marrakech)"},
                        "country": {"type":"string","description":"Code pays ISO-2 (FR, MA, ES). Si fourni, agrege les jours feries officiels via date.nager.at en plus du dataset interne."},
                        "from":    {"type":"string","format":"date","description":"Date debut inclusive (ISO YYYY-MM-DD). Defaut : aujourd'hui."},
                        "to":      {"type":"string","format":"date","description":"Date fin inclusive (ISO YYYY-MM-DD). Defaut : aujourd'hui +90j."}
                      },
                      "required": ["city"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Evenements publics et jours feries impactant la demande dans une ville sur des dates (feries si 'country'). Pour expliquer pics de demande, yield management.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
