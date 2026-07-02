package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.CalendarDay;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code block_calendar_day} — bloque une plage de dates sur une propriete.
 *
 * <p><b>requiresConfirmation = true</b> : ecrit dans le calendrier. L'orchestrateur
 * suspend l'execution et demande confirmation utilisateur via le SSE
 * {@code tool_confirmation_request} avant d'appeler ce handler.</p>
 *
 * <p>Wraps {@link CalendarEngine#block(...)} qui leve {@code CalendarConflictException}
 * si des jours sont deja bookes — l'erreur est propagee au LLM comme tool_result
 * d'erreur, le LLM peut alors expliquer le conflit a l'utilisateur.</p>
 */
@Component
public class BlockCalendarDayTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(BlockCalendarDayTool.class);
    private static final String NAME = "block_calendar_day";
    private static final String SOURCE = "ASSISTANT";

    private final CalendarEngine calendarEngine;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public BlockCalendarDayTool(CalendarEngine calendarEngine, ObjectMapper objectMapper) {
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
        // Args parsing strict — pas de defaults silencieux sur une op d'ecriture
        if (!args.has("propertyId") || !args.has("from") || !args.has("to")) {
            throw new ToolExecutionException(NAME, "propertyId, from et to sont requis");
        }
        Long propertyId = args.path("propertyId").asLong();
        LocalDate from = parseDate(args.path("from").asText(null), "from");
        LocalDate to = parseDate(args.path("to").asText(null), "to");
        String notes = args.path("notes").asText(null);

        if (from.isAfter(to)) {
            throw new ToolExecutionException(NAME, "from doit etre <= to");
        }
        if (from.isBefore(LocalDate.now().minusDays(1))) {
            // Protection : pas de blocage dans le passe (eviter les erreurs LLM)
            throw new ToolExecutionException(NAME, "Impossible de bloquer une date passee");
        }

        try {
            List<CalendarDay> days = calendarEngine.block(
                    propertyId, from, to,
                    context.organizationId(),
                    SOURCE,
                    notes,
                    context.keycloakId()
            );

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("daysBlocked", days.size());
            if (notes != null) payload.put("notes", notes);

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("block_calendar_day failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Blocage impossible (" + e.getMessage() + ")", e);
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
                        "propertyId": {"type":"integer","description":"ID de la propriete a bloquer"},
                        "from":       {"type":"string","format":"date","description":"Date debut (ISO YYYY-MM-DD), inclusive"},
                        "to":         {"type":"string","format":"date","description":"Date fin (ISO YYYY-MM-DD), exclusive"},
                        "notes":      {"type":"string","description":"Raison du blocage (visible dans le planning)"}
                      },
                      "required": ["propertyId","from","to"],
                      "additionalProperties": false
                    }
                    """);
            // requiresConfirmation = true → l'orchestrateur exigera une confirmation
            // utilisateur explicite avant d'executer ce handler.
            return ToolDescriptor.write(
                    NAME,
                    "Bloque une plage de dates du calendrier d'une propriete (jours indisponibles a la reservation). Utiliser pour renovation, sejour proprio, fermeture temporaire.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
