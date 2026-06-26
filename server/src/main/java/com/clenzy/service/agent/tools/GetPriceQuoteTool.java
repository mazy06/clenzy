package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PriceEngine;
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
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Tool {@code get_price_quote} — devis (prix) d'un logement pour des dates.
 *
 * <p>Resout les prix via le {@link PriceEngine} (cascade 6 niveaux) sur les NUITS
 * {@code [from, to-1]} (la nuit de depart n'est pas facturee). Valide l'acces au
 * logement via {@link PropertyService#getById(Long)} (org-safe). Lecture seule.</p>
 */
@Component
public class GetPriceQuoteTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetPriceQuoteTool.class);
    private static final String NAME = "get_price_quote";

    private final PriceEngine priceEngine;
    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetPriceQuoteTool(PriceEngine priceEngine, PropertyService propertyService, ObjectMapper objectMapper) {
        this.priceEngine = priceEngine;
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
        if (propertyId <= 0) {
            throw new ToolExecutionException(NAME, "propertyId requis (utiliser list_properties pour le trouver).");
        }
        LocalDate from;
        LocalDate to;
        try {
            from = LocalDate.parse(args.path("from").asText());
            to = LocalDate.parse(args.path("to").asText());
        } catch (DateTimeParseException e) {
            throw new ToolExecutionException(NAME, "Dates invalides : format AAAA-MM-JJ (from = arrivee, to = depart).");
        }
        if (!to.isAfter(from)) {
            throw new ToolExecutionException(NAME, "'to' (depart) doit etre apres 'from' (arrivee).");
        }
        try {
            // getById = org-safe (findByIdRespectingTenant) → valide aussi l'acces au logement.
            PropertyDto property = propertyService.getById(propertyId);
            // Nuits facturees = [from, to-1]. Trie par date pour un affichage stable.
            Map<LocalDate, BigDecimal> nightly = new TreeMap<>(
                    priceEngine.resolvePriceRange(propertyId, from, to.minusDays(1), context.organizationId()));

            BigDecimal total = BigDecimal.ZERO;
            List<Map<String, Object>> perNight = new ArrayList<>();
            int pricedNights = 0;
            for (Map.Entry<LocalDate, BigDecimal> e : nightly.entrySet()) {
                if (e.getValue() == null) continue;
                total = total.add(e.getValue());
                pricedNights++;
                perNight.add(Map.of("date", e.getKey().toString(), "price", e.getValue()));
            }

            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("propertyName", property.name);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("nights", pricedNights);
            payload.put("total", total);
            payload.put("currency", "EUR");
            payload.put("perNight", perNight);
            return ToolResult.success(objectMapper.writeValueAsString(payload), "quote");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize quote", e);
        } catch (Exception e) {
            log.warn("get_price_quote failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Devis indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"ID du logement (obtenu via list_properties)."},
                        "from": {"type":"string","description":"Date d'arrivee, format AAAA-MM-JJ."},
                        "to":   {"type":"string","description":"Date de depart, format AAAA-MM-JJ (non facturee)."}
                      },
                      "required": ["propertyId","from","to"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Devis du prix d'un logement pour un sejour (prix par nuit via le PriceEngine + total). Utiliser pour 'combien coute le logement du X au Y', 'quel est le prix', 'devis'. Lecture seule (ne reserve rien).",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
