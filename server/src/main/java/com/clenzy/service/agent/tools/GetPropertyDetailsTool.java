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
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code get_property_details} — fiche complete d'un logement.
 *
 * <p>Delegue a {@link PropertyService#getById(Long)} (org-safe via
 * {@code findByIdRespectingTenant}). Lecture seule.</p>
 */
@Component
public class GetPropertyDetailsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetPropertyDetailsTool.class);
    private static final String NAME = "get_property_details";

    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetPropertyDetailsTool(PropertyService propertyService, ObjectMapper objectMapper) {
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
        long propertyId = args.path("propertyId").asLong(0);
        try {
            if (propertyId <= 0) {
                // Pas d'ID fourni (ex. "details du seul logement") : si l'org n'a qu'UN
                // logement, on le resout automatiquement ; sinon on guide l'utilisateur.
                org.springframework.data.domain.Page<PropertyDto> page = propertyService.search(
                        org.springframework.data.domain.PageRequest.of(0, 2), null, null, null, null);
                if (page.getTotalElements() == 0) {
                    throw new ToolExecutionException(NAME, "Aucun logement dans cette organisation.");
                }
                if (page.getTotalElements() > 1) {
                    throw new ToolExecutionException(NAME, "Plusieurs logements ("
                            + page.getTotalElements() + ") : precise lequel via son ID (utilise list_properties).");
                }
                propertyId = page.getContent().get(0).id;
            }
            PropertyDto p = propertyService.getById(propertyId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.id);
            m.put("name", p.name);
            if (p.type != null) m.put("type", p.type.name());
            if (p.status != null) m.put("status", p.status.name());
            m.put("address", p.address);
            m.put("city", p.city);
            m.put("country", p.country);
            m.put("timezone", p.timezone);
            m.put("bedroomCount", p.bedroomCount);
            m.put("bathroomCount", p.bathroomCount);
            m.put("maxGuests", p.maxGuests);
            m.put("squareMeters", p.squareMeters);
            m.put("nightlyPrice", p.nightlyPrice);
            m.put("minimumNights", p.minimumNights);
            if (p.description != null) m.put("description", p.description);
            return ToolResult.success(objectMapper.writeValueAsString(m), "details");
        } catch (ToolExecutionException e) {
            throw e;
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize property", e);
        } catch (Exception e) {
            log.warn("get_property_details failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Detail du logement indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"ID du logement (obtenu via list_properties)."}
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Fiche complete d'un logement : adresse, capacite (chambres, salles de bain, voyageurs max), surface, prix de base/nuit, nuits minimum, type, statut, fuseau horaire. Utiliser pour 'details du logement', 'capacite', 'adresse', 'combien de chambres'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
