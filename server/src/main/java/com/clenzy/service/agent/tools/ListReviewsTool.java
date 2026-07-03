package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.integration.channel.ChannelName;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Tool {@code list_reviews} — avis voyageurs recents de l'organisation.
 *
 * <p>Retourne les derniers avis (note, commentaire tronque, canal, logement, date),
 * tries par date d'avis decroissante. Filtre optionnel par canal via {@code channel}
 * (ex: AIRBNB, BOOKING). Lecture seule.</p>
 *
 * <p>Delegue a {@link ReviewService} ({@code getAll} / {@code getByChannel}) qui
 * porte le scoping organisation (orgId requis sur chaque query du repository) —
 * l'assistant herite des memes garanties que les endpoints REST.</p>
 *
 * <p>PII : le nom du voyageur est inclus (autorise) ; aucun email/telephone n'est
 * expose. Le commentaire est tronque pour limiter le volume envoye au LLM.</p>
 */
@Component
public class ListReviewsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListReviewsTool.class);
    private static final String NAME = "list_reviews";
    private static final int MAX_REVIEWS = 25;
    private static final int MAX_COMMENT_LENGTH = 280;

    private final ReviewService reviewService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListReviewsTool(ReviewService reviewService, ObjectMapper objectMapper) {
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
        final Long orgId = context.organizationId();
        final ChannelName channel = parseChannel(args.path("channel"));
        final PageRequest pageable = PageRequest.of(
                0, MAX_REVIEWS, Sort.by(Sort.Direction.DESC, "reviewDate"));

        try {
            // Les deux methodes du service exigent orgId → scoping organisation garanti.
            Page<GuestReview> page = channel != null
                    ? reviewService.getByChannel(channel, orgId, pageable)
                    : reviewService.getAll(orgId, pageable);

            List<Map<String, Object>> items = new ArrayList<>();
            for (GuestReview review : page.getContent()) {
                items.add(toItem(review));
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalReviews", page.getTotalElements());
            if (channel != null) {
                payload.put("channelFilter", channel.name());
            }
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize reviews", e);
        } catch (Exception e) {
            log.warn("list_reviews failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Avis indisponibles (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toItem(GuestReview review) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", review.getId());
        m.put("rating", review.getRating());
        m.put("comment", truncate(review.getReviewText()));
        m.put("channel", review.getChannelName() != null ? review.getChannelName().name() : null);
        m.put("propertyId", review.getPropertyId());
        m.put("guestName", review.getGuestName());
        m.put("reviewDate", review.getReviewDate() != null ? review.getReviewDate().toString() : null);
        m.put("hasHostResponse", review.getHostResponse() != null && !review.getHostResponse().isBlank());
        return m;
    }

    private static String truncate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.strip();
        if (trimmed.length() <= MAX_COMMENT_LENGTH) {
            return trimmed;
        }
        return trimmed.substring(0, MAX_COMMENT_LENGTH).strip() + "…";
    }

    private static ChannelName parseChannel(JsonNode node) {
        if (node.isMissingNode() || node.isNull() || !node.isTextual() || node.asText().isBlank()) {
            return null;
        }
        try {
            return ChannelName.valueOf(node.asText().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME,
                    "Canal inconnu : " + node.asText() + ". Valeurs valides ex: AIRBNB, BOOKING, DIRECT.");
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "channel": {"type":"string","description":"Filtre optionnel sur le canal de l'avis (ex: AIRBNB, BOOKING, DIRECT). Omettre pour tous les canaux."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les avis voyageurs recents : note (1-5), commentaire, canal, logement, date. Filtre canal optionnel. Pour 'derniers avis', 'notes recues', 'avis Airbnb'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
