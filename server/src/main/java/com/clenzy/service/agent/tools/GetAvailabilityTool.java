package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.service.CalendarEngine;
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
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code get_availability} — disponibilite d'un logement sur une periode.
 *
 * <p>Convention CalendarEngine : absence de {@code CalendarDay} OU statut
 * {@code AVAILABLE} = jour libre ; tout autre statut (BOOKED / BLOCKED /
 * MAINTENANCE) = indisponible. Delegue a {@link CalendarEngine#getDays} (org-safe :
 * orgId passe en parametre + filtre tenant). Lecture seule.</p>
 */
@Component
public class GetAvailabilityTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetAvailabilityTool.class);
    private static final String NAME = "get_availability";
    private static final int MAX_DAYS = 90;

    private final CalendarEngine calendarEngine;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetAvailabilityTool(CalendarEngine calendarEngine, ObjectMapper objectMapper) {
        this.calendarEngine = calendarEngine;
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
            throw new ToolExecutionException(NAME, "Dates invalides : utiliser le format AAAA-MM-JJ (from, to).");
        }
        if (to.isBefore(from)) {
            throw new ToolExecutionException(NAME, "'to' doit etre apres ou egal a 'from'.");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_DAYS) {
            to = from.plusDays(MAX_DAYS);
        }
        try {
            List<CalendarDay> days = calendarEngine.getDays(propertyId, from, to, context.organizationId());
            Map<LocalDate, CalendarDay> byDate = new HashMap<>();
            for (CalendarDay d : days) {
                byDate.put(d.getDate(), d);
            }

            List<Map<String, Object>> perDay = new ArrayList<>();
            int available = 0;
            int unavailable = 0;
            for (LocalDate cur = from; !cur.isAfter(to); cur = cur.plusDays(1)) {
                CalendarDay d = byDate.get(cur);
                boolean isAvailable = d == null || d.getStatus() == CalendarDayStatus.AVAILABLE;
                if (isAvailable) {
                    available++;
                } else {
                    unavailable++;
                }
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("date", cur.toString());
                e.put("available", isAvailable);
                e.put("status", isAvailable ? "AVAILABLE"
                        : (d.getStatus() != null ? d.getStatus().name() : "BLOCKED"));
                perDay.add(e);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("availableNights", available);
            payload.put("unavailableNights", unavailable);
            payload.put("fullyAvailable", unavailable == 0);
            payload.put("days", perDay);
            return ToolResult.success(objectMapper.writeValueAsString(payload), "availability");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize availability", e);
        } catch (Exception e) {
            log.warn("get_availability failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Disponibilite indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"ID du logement (obtenu via list_properties)."},
                        "from": {"type":"string","description":"Date de debut incluse, format AAAA-MM-JJ."},
                        "to":   {"type":"string","description":"Date de fin incluse, format AAAA-MM-JJ."}
                      },
                      "required": ["propertyId","from","to"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Disponibilite jour par jour d'un logement (libre/reserve/bloque/maintenance) + nuits libres. Max 90 jours. Pour 'est-ce dispo du X au Y', 'quels jours libres'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
