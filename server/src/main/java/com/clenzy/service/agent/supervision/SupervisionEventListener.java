package com.clenzy.service.agent.supervision;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Reçoit les événements de supervision diffusés par Redis pub/sub (toutes instances) et
 * les redistribue aux connexions SSE LOCALES du logement concerné ({@link SupervisionSseRegistry}).
 * Ainsi une résolution / une activité sur n'importe quelle instance atteint tous les opérateurs.
 */
@Component
public class SupervisionEventListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(SupervisionEventListener.class);

    private final SupervisionSseRegistry registry;
    private final ObjectMapper objectMapper;

    public SupervisionEventListener(SupervisionSseRegistry registry, ObjectMapper objectMapper) {
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            final JsonNode root = objectMapper.readTree(new String(message.getBody(), StandardCharsets.UTF_8));
            final JsonNode event = root.path("event");
            if (root.path("propertyId").isNumber() && !event.isMissingNode()) {
                registry.broadcast(root.path("propertyId").asLong(), objectMapper.writeValueAsString(event));
            }
        } catch (Exception e) {
            log.debug("SSE supervision listener: message ignoré ({})", e.getMessage());
        }
    }
}
