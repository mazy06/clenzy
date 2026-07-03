package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.TouristTaxReportDto;
import com.clenzy.dto.TouristTaxReportLineDto;
import com.clenzy.service.TouristTaxService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Tool {@code compute_tourist_tax} — calcul de taxe de séjour (read-only).
 *
 * <p>Deux usages exclusifs :</p>
 * <ul>
 *   <li>{@code reservationId} : taxe d'UNE réservation (barème résolu :
 *       override par bien &gt; défaut org) ;</li>
 *   <li>{@code from} + {@code to} (ISO yyyy-MM-dd) : rapport de période —
 *       réservations confirmées par date de check-out, total collecté.</li>
 * </ul>
 *
 * <p>Tenant-safe : l'org vient de l'{@link AgentContext}, jamais des args ;
 * une réservation d'une autre org est traitée comme introuvable.</p>
 */
@Component
public class ComputeTouristTaxTool implements ToolHandler {

    private static final String NAME = "compute_tourist_tax";
    /** Bornage du payload renvoyé au LLM (le total reste calculé sur TOUTES les lignes). */
    private static final int MAX_LINES = 50;

    private final TouristTaxService touristTaxService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ComputeTouristTaxTool(TouristTaxService touristTaxService, ObjectMapper objectMapper) {
        this.touristTaxService = touristTaxService;
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
        Long reservationId = optLong(args, "reservationId");
        LocalDate from = optDate(args, "from");
        LocalDate to = optDate(args, "to");

        try {
            if (reservationId != null) {
                return ToolResult.success(reservationPayload(reservationId, context.organizationId()));
            }
            if (from != null && to != null) {
                return ToolResult.success(periodPayload(from, to, context.organizationId()));
            }
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize tourist tax payload", e);
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        }
        throw new ToolExecutionException(NAME,
                "Indique soit 'reservationId', soit une période 'from' + 'to' (yyyy-MM-dd)");
    }

    private String reservationPayload(Long reservationId, Long orgId) throws JsonProcessingException {
        Optional<TouristTaxReportLineDto> line = touristTaxService.computeForReservationId(reservationId, orgId);
        if (line.isEmpty()) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("reservationId", reservationId);
            payload.put("taxAmount", null);
            payload.put("reason", "Réservation introuvable, séjour sans nuit taxable, "
                    + "ou aucun barème de taxe de séjour configuré (ni par bien, ni par défaut d'org)");
            return objectMapper.writeValueAsString(payload);
        }
        return objectMapper.writeValueAsString(line.get());
    }

    private String periodPayload(LocalDate from, LocalDate to, Long orgId) throws JsonProcessingException {
        TouristTaxReportDto report = touristTaxService.computeForPeriod(orgId, from, to);
        List<TouristTaxReportLineDto> lines = report.lines().size() > MAX_LINES
                ? report.lines().subList(0, MAX_LINES) : report.lines();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", "Taxe de séjour du " + from + " au " + to);
        payload.put("from", from.toString());
        payload.put("to", to.toString());
        payload.put("totalTax", report.totalTax());
        payload.put("reservationCount", report.reservationCount());
        payload.put("missingConfigCount", report.missingConfigCount());
        payload.put("lines", lines);
        if (report.lines().size() > MAX_LINES) {
            payload.put("truncated", true);
            payload.put("truncatedNote", "Seules les " + MAX_LINES
                    + " premières lignes sont listées — le total porte sur toutes les réservations");
        }
        return objectMapper.writeValueAsString(payload);
    }

    private static Long optLong(JsonNode args, String key) {
        JsonNode node = args.path(key);
        return node.isMissingNode() || node.isNull() ? null : node.asLong();
    }

    private static LocalDate optDate(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull() || node.asText("").isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(node.asText());
        } catch (DateTimeParseException e) {
            throw new ToolExecutionException(NAME,
                    "Date invalide pour '" + key + "' : attendu yyyy-MM-dd", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"Id de réservation : calcule la taxe de séjour de CE séjour"},
                        "from":          {"type":"string","format":"date","description":"Début de période (yyyy-MM-dd) — à combiner avec 'to'"},
                        "to":            {"type":"string","format":"date","description":"Fin de période (yyyy-MM-dd) — réservations par date de check-out"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Calcule la taxe de séjour : pour une réservation (reservationId) ou en rapport de période "
                            + "(from+to, par date de check-out) avec total collecté. Barèmes saisis par l'org "
                            + "(override par bien > défaut org). Read-only.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
