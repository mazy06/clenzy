package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.ReviewSentimentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code analyze_reviews} — analyse de sentiment et de thèmes des avis
 * voyageurs (note moyenne, distribution, tendance, thèmes récurrents, avis à
 * risque non répondus). Lecture seule.
 *
 * <p>Délègue à {@link ReviewSentimentService}. Sert le chat (« que disent mes
 * avis ? ») ET les scans autonomes (suggestion « répondre à l'avis négatif »,
 * « 3 avis citent la propreté → action »). Agent constellation : {@code rep}.</p>
 */
@Component
public class AnalyzeReviewsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(AnalyzeReviewsTool.class);
    private static final String NAME = "analyze_reviews";

    private final ReviewSentimentService reviewSentimentService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public AnalyzeReviewsTool(ReviewSentimentService reviewSentimentService, ObjectMapper objectMapper) {
        this.reviewSentimentService = reviewSentimentService;
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
            ReviewSentimentService.AnalysisResult result = reviewSentimentService.analyze();
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize review analysis", e);
        } catch (Exception e) {
            log.warn("analyze_reviews failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Analyse des avis indisponible (" + e.getMessage() + ")", e);
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
                    "Analyse les avis voyageurs de l'organisation : note moyenne, distribution des notes, "
                            + "tendance récente, thèmes récurrents (propreté, bruit, arrivée, équipements, "
                            + "qualité-prix, emplacement, communication) avec leur sentiment, et avis à risque "
                            + "réputationnel non répondus. Utiliser pour 'que disent mes avis', 'quels sont les "
                            + "points faibles', 'ma satisfaction voyageur', 'avis à traiter', 'thèmes récurrents'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
