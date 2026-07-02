package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.RateOverrideService;
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
import java.util.Map;

/**
 * Tool {@code set_rate_override} — pose un tarif override (prix/nuit force) sur une
 * propriete pour une date ou une plage de dates.
 *
 * <p>C'est de la <b>configuration pricing</b> (priorite maximale du PriceEngine),
 * pas une transaction de paiement : aucun montant client n'est encaisse ici.</p>
 *
 * <p><b>requiresConfirmation = true</b> : ecrit dans la config tarifaire.
 * L'orchestrateur suspend l'execution et demande une confirmation utilisateur
 * via le SSE {@code tool_confirmation_request} avant d'appeler ce handler.</p>
 *
 * <p>Tool mince : delegue entierement a
 * {@link RateOverrideService#createBulk(Map, String)} qui valide l'acces a la
 * propriete (org courante + super admin + platform staff + owner) et porte la
 * transaction. La plage {@code [from, to)} suit la semantique du service ({@code to}
 * exclusive). Pour une seule date, passer {@code to = from + 1 jour}.</p>
 */
@Component
public class SetRateOverrideTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SetRateOverrideTool.class);
    private static final String NAME = "set_rate_override";

    private final RateOverrideService rateOverrideService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SetRateOverrideTool(RateOverrideService rateOverrideService, ObjectMapper objectMapper) {
        this.rateOverrideService = rateOverrideService;
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
        // Args parsing strict — pas de defaults silencieux sur une op d'ecriture
        if (!args.has("propertyId") || !args.has("from") || !args.has("price")) {
            throw new ToolExecutionException(NAME, "propertyId, from et price sont requis");
        }
        Long propertyId = args.path("propertyId").asLong();
        LocalDate from = parseDate(args.path("from").asText(null), "from");
        // to optionnel : par defaut, une seule nuit (from + 1, car borne exclusive)
        LocalDate to = args.hasNonNull("to")
                ? parseDate(args.path("to").asText(null), "to")
                : from.plusDays(1);

        double price = args.path("price").asDouble(Double.NaN);
        if (Double.isNaN(price) || price <= 0) {
            throw new ToolExecutionException(NAME, "price doit etre un nombre strictement positif");
        }
        if (!to.isAfter(from)) {
            throw new ToolExecutionException(NAME, "to doit etre strictement apres from (borne exclusive)");
        }

        try {
            // createBulk valide l'acces propriete (org-safe) et porte la transaction.
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("propertyId", propertyId);
            body.put("from", from.toString());
            body.put("to", to.toString());
            body.put("nightlyPrice", price);

            Map<String, Object> result = rateOverrideService.createBulk(body, context.keycloakId());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("nightlyPrice", price);
            payload.put("nightsAffected", result.get("count"));
            payload.put("message", "Tarif override de " + price + " applique sur "
                    + result.get("count") + " nuit(s).");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("set_rate_override failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Pose du tarif override impossible (" + e.getMessage() + ")", e);
        }
    }

    private static LocalDate parseDate(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            throw new ToolExecutionException(NAME, fieldName + " est requis");
        }
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            throw new ToolExecutionException(NAME, fieldName + " invalide : '" + raw + "' (format YYYY-MM-DD)");
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID du logement"},
                        "from":       {"type":"string","format":"date","description":"REQUIS : date debut (ISO YYYY-MM-DD), inclusive"},
                        "to":         {"type":"string","format":"date","description":"Date fin (ISO YYYY-MM-DD), EXCLUSIVE. Omettre pour une seule nuit."},
                        "price":      {"type":"number","description":"REQUIS : prix/nuit force (devise par defaut du logement)"}
                      },
                      "required": ["propertyId","from","price"],
                      "additionalProperties": false
                    }
                    """);
            // requiresConfirmation = true → l'orchestrateur exigera une confirmation
            // utilisateur explicite avant d'executer ce handler.
            return ToolDescriptor.write(
                    NAME,
                    "Force le prix/nuit d'un logement sur une date ou plage (override prioritaire PriceEngine). Config tarif, PAS un paiement. Date fin exclusive ; omise = 1 nuit.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
