package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code list_properties} — liste paginee des proprietes de l'organisation.
 *
 * <p>Wraps {@link PropertyService#search(...)}. Filtres optionnels :
 * {@code city}, {@code status} ({@code AVAILABLE}/{@code MAINTENANCE}/{@code OFFLINE}),
 * {@code type} ({@code APARTMENT}/{@code HOUSE}/{@code VILLA}/...), {@code limit}.</p>
 *
 * <p>Limit max = 50 (eviter de gonfler le contexte LLM).</p>
 */
@Component
public class ListPropertiesTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListPropertiesTool.class);
    private static final String NAME = "list_properties";
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListPropertiesTool(PropertyService propertyService, ObjectMapper objectMapper) {
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
        // Args parsing — tous optionnels.
        String city = optString(args, "city");
        PropertyStatus status = parseEnum(PropertyStatus.class, optString(args, "status"));
        PropertyType type = parseEnum(PropertyType.class, optString(args, "type"));
        int limit = Math.min(MAX_LIMIT, Math.max(1, args.path("limit").asInt(DEFAULT_LIMIT)));

        try {
            Page<PropertyDto> page = propertyService.search(
                    PageRequest.of(0, limit, Sort.by("name").ascending()),
                    null, status, type, city);

            List<Map<String, Object>> items = page.getContent().stream()
                    .map(this::compact)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalElements", page.getTotalElements());
            payload.put("truncated", page.getTotalElements() > items.size());

            String json = objectMapper.writeValueAsString(payload);
            return ToolResult.success(json, "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize properties", e);
        } catch (Exception e) {
            log.warn("list_properties: lookup failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Liste des proprietes indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> compact(PropertyDto p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("name", p.name);
        if (p.city != null) m.put("city", p.city);
        if (p.country != null) m.put("country", p.country);
        if (p.status != null) m.put("status", p.status.name());
        if (p.type != null) m.put("type", p.type.name());
        return m;
    }

    private static String optString(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("");
        return s.isBlank() ? null : s;
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value) {
        if (value == null) return null;
        try {
            return Enum.valueOf(type, value.toUpperCase());
        } catch (IllegalArgumentException e) {
            // Argument LLM invalide : on ignore plutot que d'echouer dur, le LLM verra
            // probablement la liste complete et pourra re-filtrer dans son prompt.
            return null;
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "city":   {"type":"string","description":"Filtre par ville (insensible casse, recherche partielle)"},
                        "status": {"type":"string","enum":["ACTIVE","INACTIVE","UNDER_MAINTENANCE","ARCHIVED"],"description":"Filtre par statut"},
                        "type":   {"type":"string","enum":["APARTMENT","HOUSE","STUDIO","VILLA","LOFT","DUPLEX","TOWNHOUSE","BUNGALOW","RIAD","GUEST_ROOM","COTTAGE","CHALET","BOAT","OTHER"],"description":"Filtre par type de bien"},
                        "limit":  {"type":"integer","minimum":1,"maximum":50,"description":"Nombre max d'items retournes (defaut 20)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les proprietes de l'organisation avec filtres optionnels (ville, statut, type, limit). Utiliser quand l'utilisateur demande quelles proprietes il a, ou pour filtrer un sous-ensemble.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
