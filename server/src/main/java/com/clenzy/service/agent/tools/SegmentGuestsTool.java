package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.GuestAnalyticsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code segment_guests} — segmentation des voyageurs (NEW / REPEAT / VIP)
 * à partir de l'historique (séjours, dépense). Lecture seule.
 *
 * <p>Délègue à {@link GuestAnalyticsService}. Sert le chat (« quels sont mes
 * voyageurs fidèles / VIP ? ») ET les scans autonomes (suggestion de ciblage :
 * message premium aux VIP, offre retour aux fidèles). Agent constellation : {@code com}.</p>
 */
@Component
public class SegmentGuestsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SegmentGuestsTool.class);
    private static final String NAME = "segment_guests";

    private final GuestAnalyticsService guestAnalyticsService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SegmentGuestsTool(GuestAnalyticsService guestAnalyticsService, ObjectMapper objectMapper) {
        this.guestAnalyticsService = guestAnalyticsService;
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
            GuestAnalyticsService.SegmentationResult result = guestAnalyticsService.segment();
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize guest segmentation", e);
        } catch (Exception e) {
            log.warn("segment_guests failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Segmentation des voyageurs indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {},
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Segmente les voyageurs de l'organisation en groupes actionnables à partir de leur "
                            + "historique : NEW (1 séjour), REPEAT (≥2 séjours), VIP (dépense ≥ 2× la moyenne). "
                            + "Retourne par segment le nombre, la dépense totale/moyenne, des exemples, et une "
                            + "recommandation de ciblage. Utiliser pour 'mes voyageurs fidèles', 'mes meilleurs "
                            + "clients', 'qui cibler', 'segmentation des voyageurs', 'qui sont mes VIP'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
