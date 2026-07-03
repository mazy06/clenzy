package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code get_property_amenities} — equipements (amenities) d'un logement.
 *
 * <p>Avec {@code propertyId} : equipements de ce logement. Sans : equipements de
 * tous les logements de l'organisation (limite). Lecture seule.</p>
 *
 * <p>Delegue a {@link PropertyService} (filtrage multi-tenant via
 * {@code findByIdRespectingTenant} pour getById, et le filtre Hibernate pour
 * search) — l'assistant herite des memes garanties que les endpoints REST.</p>
 */
@Component
public class GetPropertyAmenitiesTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetPropertyAmenitiesTool.class);
    private static final String NAME = "get_property_amenities";
    private static final int MAX_PROPERTIES = 20;

    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetPropertyAmenitiesTool(PropertyService propertyService, ObjectMapper objectMapper) {
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
        JsonNode idNode = args.path("propertyId");
        boolean hasId = !idNode.isMissingNode() && !idNode.isNull()
                && (idNode.isNumber() || (idNode.isTextual() && !idNode.asText().isBlank()));

        try {
            List<Map<String, Object>> items = new ArrayList<>();
            if (hasId) {
                // getById delegue a findByIdRespectingTenant → renvoie uniquement
                // un logement de l'organisation courante (pas d'IDOR).
                items.add(toItem(propertyService.getById(idNode.asLong())));
            } else {
                Page<PropertyDto> page = propertyService.search(
                        PageRequest.of(0, MAX_PROPERTIES, Sort.by("name").ascending()),
                        null, null, null, null);
                for (PropertyDto dto : page.getContent()) {
                    items.add(toItem(dto));
                }
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize amenities", e);
        } catch (Exception e) {
            log.warn("get_property_amenities failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Equipements indisponibles (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toItem(PropertyDto p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("name", p.name);
        List<String> amenities = p.amenities != null ? p.amenities : List.of();
        m.put("amenities", amenities);
        m.put("amenityCount", amenities.size());
        return m;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"ID du logement. Omettre pour retourner les equipements de tous les logements de l'organisation."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Equipements (amenities) d'un logement, ou de tous les logements de l'org sans propertyId. Pour 'quels equipements', 'y a-t-il piscine/wifi'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
