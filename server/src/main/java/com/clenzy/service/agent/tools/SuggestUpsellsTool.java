package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.UpsellSuggestionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code suggest_upsells} — opportunités d'upsell sur les séjours à venir
 * (nuit en plus / arrivée anticipée / départ tardif selon les trous de calendrier).
 * Lecture seule : <b>propose</b>, ne crée rien.
 *
 * <p>Délègue à {@link UpsellSuggestionService}. Sert le chat (« où puis-je vendre
 * plus ? ») ET les scans autonomes. Agent constellation : {@code com}.</p>
 */
@Component
public class SuggestUpsellsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SuggestUpsellsTool.class);
    private static final String NAME = "suggest_upsells";
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final UpsellSuggestionService upsellSuggestionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SuggestUpsellsTool(UpsellSuggestionService upsellSuggestionService, ObjectMapper objectMapper) {
        this.upsellSuggestionService = upsellSuggestionService;
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
            int windowDays = args != null && args.hasNonNull("windowDays")
                    ? args.get("windowDays").asInt(DEFAULT_WINDOW_DAYS)
                    : DEFAULT_WINDOW_DAYS;
            UpsellSuggestionService.UpsellResult result = upsellSuggestionService.suggest(windowDays);
            return ToolResult.success(objectMapper.writeValueAsString(result), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize upsell suggestions", e);
        } catch (Exception e) {
            log.warn("suggest_upsells failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Suggestions d'upsell indisponibles (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "windowDays": {
                          "type": "integer",
                          "description": "Fenêtre des séjours à venir en jours (défaut 30, max 120)."
                        }
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Détecte les opportunités d'upsell sur les séjours confirmés à venir : nuit "
                            + "supplémentaire (la veille / au départ), arrivée anticipée, départ tardif, à partir "
                            + "des nuits libres autour de chaque réservation. Retourne une liste (réservation, "
                            + "logement, guest, dates, upsells proposés). Propose, ne crée rien. Utiliser pour "
                            + "'où puis-je vendre plus', 'opportunités d'upsell', 'proposer une nuit en plus', "
                            + "'upsell early/late check-in'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
