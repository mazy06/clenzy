package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.PricingRecommendationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code recommend_price_adjustments} — recommandations de prix CONTINUES
 * par créneau pour une propriété (occupation réelle + validation par simulation
 * à élasticité réelle). Lecture seule, ne modifie aucun tarif.
 *
 * <p>Délègue à {@link PricingRecommendationService}. Sert le chat ET les scans
 * autonomes de la constellation (suggestions « baisser/monter de X% »). Les
 * ajustements ne sont JAMAIS appliqués automatiquement (mode suggest).</p>
 */
@Component
public class RecommendPriceAdjustmentsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(RecommendPriceAdjustmentsTool.class);
    private static final String NAME = "recommend_price_adjustments";
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final PricingRecommendationService pricingRecommendationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public RecommendPriceAdjustmentsTool(PricingRecommendationService pricingRecommendationService,
                                         ObjectMapper objectMapper) {
        this.pricingRecommendationService = pricingRecommendationService;
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
            if (args == null || !args.hasNonNull("propertyId")) {
                throw new ToolExecutionException(NAME, "Paramètre 'propertyId' requis.");
            }
            long propertyId = args.get("propertyId").asLong();
            int windowDays = args.hasNonNull("windowDays")
                    ? args.get("windowDays").asInt(DEFAULT_WINDOW_DAYS)
                    : DEFAULT_WINDOW_DAYS;

            List<PricingRecommendationService.PriceRecommendation> recs =
                    pricingRecommendationService.recommend(propertyId, windowDays, context.keycloakId());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("windowDays", Math.max(7, Math.min(windowDays, 90)));
            payload.put("recommendations", recs);
            payload.put("count", recs.size());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (ToolExecutionException e) {
            throw e;
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize price recommendations", e);
        } catch (Exception e) {
            log.warn("recommend_price_adjustments failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Recommandations de prix indisponibles (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {
                          "type": "integer",
                          "description": "Identifiant du logement."
                        },
                        "windowDays": {
                          "type": "integer",
                          "description": "Horizon en jours (défaut 30, min 7, max 90)."
                        }
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Recommande des ajustements de prix par créneau pour un logement, sur l'horizon à venir : "
                            + "repère les créneaux qui sous-vendent (occupation faible → baisse suggérée) ou "
                            + "sur-vendent (occupation élevée → hausse), à partir du calendrier réel, et valide "
                            + "chaque proposition via une simulation à élasticité réelle (les propositions "
                            + "revenue-négatives sont écartées). Retourne pour chaque créneau : occupation, prix "
                            + "moyen courant, ajustement suggéré (%) ; et l'impact revenu simulé du delta sur la "
                            + "fenêtre d'analyse (indépendant du créneau). Ne modifie JAMAIS les "
                            + "tarifs. Utiliser pour 'quels prix ajuster', 'où baisser/monter mes prix', "
                            + "'optimiser mon revenu sur les prochaines semaines'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
