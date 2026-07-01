package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.batch.BatchCalendarService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Tool {@code preview_batch_block_calendar} — DRY-RUN d'un blocage calendrier
 * multi-logements (P2-12). Lecture seule : n'écrit rien, calcule l'effet exact
 * (nuits à bloquer / conflits par logement) et retourne un <b>token</b> à passer à
 * {@code batch_block_calendar} pour appliquer. Agent constellation : {@code ops}.
 */
@Component
public class PreviewBatchBlockCalendarTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(PreviewBatchBlockCalendarTool.class);
    private static final String NAME = "preview_batch_block_calendar";

    private final BatchCalendarService batchCalendarService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public PreviewBatchBlockCalendarTool(BatchCalendarService batchCalendarService, ObjectMapper objectMapper) {
        this.batchCalendarService = batchCalendarService;
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
        try {
            List<Long> propertyIds = BatchToolArgs.propertyIds(args, NAME);
            LocalDate from = BatchToolArgs.date(args, "from", NAME);
            LocalDate to = BatchToolArgs.date(args, "to", NAME);
            String notes = args.path("notes").asText(null);

            BatchCalendarService.BatchPreview preview =
                    batchCalendarService.preview(context.organizationId(), propertyIds, from, to, notes);
            return ToolResult.success(objectMapper.writeValueAsString(preview), "summary");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize preview", e);
        } catch (Exception e) {
            log.warn("preview_batch_block_calendar failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Preview impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyIds": {
                          "type": "array",
                          "items": {"type": "integer"},
                          "description": "IDs des logements à bloquer (max 50)."
                        },
                        "from": {"type": "string", "format": "date", "description": "Date début (YYYY-MM-DD), inclusive."},
                        "to": {"type": "string", "format": "date", "description": "Date fin (YYYY-MM-DD), inclusive."},
                        "notes": {"type": "string", "description": "Raison du blocage (visible dans le planning)."}
                      },
                      "required": ["propertyIds", "from", "to"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "DRY-RUN (n'écrit rien) d'un blocage calendrier sur PLUSIEURS logements : calcule par "
                            + "logement les nuits qui seraient bloquées et les conflits (jours déjà réservés), et "
                            + "retourne un token de confirmation. Utiliser AVANT batch_block_calendar pour fermer "
                            + "un parc le temps d'une maintenance/saison. Toujours prévisualiser puis montrer le "
                            + "résultat à l'utilisateur avant d'appliquer.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
