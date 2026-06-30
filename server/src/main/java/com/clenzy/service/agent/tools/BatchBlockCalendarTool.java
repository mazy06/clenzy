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
 * Tool {@code batch_block_calendar} — APPLIQUE un blocage calendrier multi-logements
 * (P2-12). Écriture : {@code requiresConfirmation=true} (confirmation utilisateur via
 * l'orchestrateur). Exige le <b>confirmationToken</b> retourné par
 * {@code preview_batch_block_calendar} (preview obligatoire), borne le lot (≤50),
 * revalide l'ownership par logement et ignore les conflits sans casser le lot.
 * Agent constellation : {@code ops}.
 */
@Component
public class BatchBlockCalendarTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(BatchBlockCalendarTool.class);
    private static final String NAME = "batch_block_calendar";

    private final BatchCalendarService batchCalendarService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public BatchBlockCalendarTool(BatchCalendarService batchCalendarService, ObjectMapper objectMapper) {
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
            String token = args.path("confirmationToken").asText(null);

            BatchCalendarService.BatchApplyResult result = batchCalendarService.apply(
                    context.organizationId(), context.keycloakId(),
                    propertyIds, from, to, notes, token);
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("batch_block_calendar failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Blocage en lot impossible (" + e.getMessage() + ")", e);
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
                          "description": "IDs des logements à bloquer (mêmes que le preview, max 50)."
                        },
                        "from": {"type": "string", "format": "date", "description": "Date début (YYYY-MM-DD), inclusive."},
                        "to": {"type": "string", "format": "date", "description": "Date fin (YYYY-MM-DD), inclusive."},
                        "notes": {"type": "string", "description": "Raison du blocage (mêmes que le preview)."},
                        "confirmationToken": {"type": "string", "description": "Token retourné par preview_batch_block_calendar pour le même périmètre."}
                      },
                      "required": ["propertyIds", "from", "to", "confirmationToken"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "APPLIQUE le blocage calendrier sur plusieurs logements à la fois. Exige le "
                            + "confirmationToken d'un preview_batch_block_calendar préalable sur le MÊME périmètre "
                            + "(sinon refus). Borné à 50 logements, ownership revalidé par logement, les logements "
                            + "avec des jours déjà réservés sont ignorés (jamais d'écrasement d'une réservation). "
                            + "Ne touche à aucun paiement. Utiliser après avoir prévisualisé et obtenu l'accord "
                            + "de l'utilisateur.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
