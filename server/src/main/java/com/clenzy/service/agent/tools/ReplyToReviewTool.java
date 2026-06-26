package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
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

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code reply_to_review} — enregistre la reponse de l'hote a un avis voyageur.
 *
 * <p><b>requiresConfirmation = true</b> : publie un texte au nom de l'hote.
 * L'orchestrateur suspend l'execution et demande une confirmation utilisateur
 * via le SSE {@code tool_confirmation_request} avant d'appeler ce handler.</p>
 *
 * <p>Tool mince : delegue entierement a
 * {@link ReviewService#respondToReview(Long, Long, String)}. Ce service charge
 * l'avis par {@code (id, orgId)} — l'org du contexte assistant garantit qu'un avis
 * d'une autre organisation n'est jamais modifiable (org-safe).</p>
 *
 * <p>La reponse de l'hote est stockee en <b>texte simple</b> : on ne construit
 * aucun HTML a partir de l'entree utilisateur.</p>
 */
@Component
public class ReplyToReviewTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ReplyToReviewTool.class);
    private static final String NAME = "reply_to_review";

    private final ReviewService reviewService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ReplyToReviewTool(ReviewService reviewService, ObjectMapper objectMapper) {
        this.reviewService = reviewService;
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
        if (!args.hasNonNull("reviewId")) {
            throw new ToolExecutionException(NAME, "reviewId est requis");
        }
        if (!args.hasNonNull("responseText") || args.path("responseText").asText().isBlank()) {
            throw new ToolExecutionException(NAME, "responseText est requis");
        }
        Long reviewId = args.path("reviewId").asLong();
        String responseText = args.path("responseText").asText();

        try {
            // respondToReview charge l'avis par (id, orgId) → org-safe par construction.
            GuestReview review = reviewService.respondToReview(
                    reviewId, context.organizationId(), responseText);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", review.getId());
            payload.put("guestName", review.getGuestName());
            payload.put("rating", review.getRating());
            payload.put("hostResponse", review.getHostResponse());
            payload.put("respondedAt", review.getHostRespondedAt() != null
                    ? review.getHostRespondedAt().toString() : null);
            payload.put("message", "Reponse enregistree sur l'avis #" + reviewId + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("reply_to_review failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Reponse a l'avis impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reviewId":     {"type":"integer","description":"REQUIS : ID de l'avis voyageur a repondre"},
                        "responseText": {"type":"string","description":"REQUIS : texte de la reponse de l'hote (texte simple, pas de HTML)"}
                      },
                      "required": ["reviewId","responseText"],
                      "additionalProperties": false
                    }
                    """);
            // requiresConfirmation = true → confirmation utilisateur exigee avant execution.
            return ToolDescriptor.write(
                    NAME,
                    "Enregistre la reponse de l'hote a un avis voyageur (affichee publiquement avec l'avis). Confirmer obligatoirement le texte avant publication.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
