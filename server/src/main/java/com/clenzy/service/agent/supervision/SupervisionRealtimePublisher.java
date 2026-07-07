package com.clenzy.service.agent.supervision;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Diffuse les événements temps réel de la constellation via Redis pub/sub (réutilise
 * l'infra existante {@code StringRedisTemplate}). Chaque message = {@code {propertyId, event}}
 * où {@code event} suit le contrat {@code StreamEvent} du front (feed.added / pending.resolved).
 * Reçu par {@link SupervisionEventListener} sur chaque instance → {@link SupervisionSseRegistry}.
 * Best-effort : un échec de diffusion ne casse jamais l'action métier.
 */
@Component
public class SupervisionRealtimePublisher {

    public static final String CHANNEL = "clenzy:supervision:events";

    private static final Logger log = LoggerFactory.getLogger(SupervisionRealtimePublisher.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public SupervisionRealtimePublisher(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /** Nouvelle entrée de feed poussée en temps réel (T6). */
    public void publishFeedAdded(Long propertyId, Long activityId, String moduleKey,
                                 String toolName, String summary, Instant at) {
        if (propertyId == null || moduleKey == null) {
            return;
        }
        final Map<String, Object> entry = new HashMap<>();
        entry.put("id", activityId != null ? String.valueOf(activityId) : "sse-" + System.identityHashCode(summary));
        entry.put("agentId", moduleKey);
        entry.put("at", (at != null ? at : Instant.now()).toString());
        entry.put("text", summary);
        if (toolName != null) {
            entry.put("toolName", toolName);
        }
        final Map<String, Object> event = new HashMap<>();
        event.put("type", "feed.added");
        event.put("entry", entry);
        publish(propertyId, event);
    }

    /** Résolution d'une carte poussée aux autres opérateurs (B6). */
    public void publishPendingResolved(Long propertyId, Long suggestionId, String outcome, String by) {
        if (propertyId == null || suggestionId == null) {
            return;
        }
        final Map<String, Object> event = new HashMap<>();
        event.put("type", "pending.resolved");
        event.put("actionId", String.valueOf(suggestionId));
        event.put("outcome", outcome);
        if (by != null) {
            event.put("by", by);
        }
        publish(propertyId, event);
    }

    private void publish(Long propertyId, Map<String, Object> event) {
        try {
            final Map<String, Object> message = new HashMap<>();
            message.put("propertyId", propertyId);
            message.put("event", event);
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.debug("SSE supervision publish échoué (property={}): {}", propertyId, e.getMessage());
        }
    }
}
