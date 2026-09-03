package com.clenzy.service.device;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Reçoit les changements d'objets connectés diffusés par Redis pub/sub (toutes
 * instances) et les redistribue aux connexions SSE LOCALES de l'organisation
 * concernée ({@link DeviceSseRegistry}).
 *
 * <p>Sans ce relais, un webhook Nuki traité par l'instance A n'atteindrait pas un
 * hub ouvert sur l'instance B.</p>
 */
@Component
public class DeviceEventListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(DeviceEventListener.class);

    private final DeviceSseRegistry registry;
    private final ObjectMapper objectMapper;

    public DeviceEventListener(DeviceSseRegistry registry, ObjectMapper objectMapper) {
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            final JsonNode root =
                    objectMapper.readTree(new String(message.getBody(), StandardCharsets.UTF_8));
            final JsonNode event = root.path("event");
            if (root.path("organizationId").isNumber() && !event.isMissingNode()) {
                registry.broadcast(root.path("organizationId").asLong(),
                        objectMapper.writeValueAsString(event));
            }
        } catch (Exception e) {
            log.debug("SSE objets connectés : message ignoré ({})", e.getMessage());
        }
    }
}
