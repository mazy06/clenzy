package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseDevice;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Consumer Kafka pour les webhooks Minut.
 * Filtre les evenements "disturbance" et evalue le niveau de bruit
 * via NoiseAlertService.
 */
@Service
public class MinutWebhookConsumer {

    private static final Logger log = LoggerFactory.getLogger(MinutWebhookConsumer.class);

    private final ObjectMapper objectMapper;
    private final NoiseDeviceRepository deviceRepository;
    private final NoiseAlertService noiseAlertService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public MinutWebhookConsumer(ObjectMapper objectMapper,
                                 NoiseDeviceRepository deviceRepository,
                                 NoiseAlertService noiseAlertService,
                                 KafkaTemplate<String, Object> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.deviceRepository = deviceRepository;
        this.noiseAlertService = noiseAlertService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_MINUT_WEBHOOKS, groupId = "clenzy-minut-noise")
    public void handleMinutWebhook(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(
                payload, new TypeReference<Map<String, Object>>() {});

            String eventType = extractString(event, "event_type");
            if (!"disturbance".equalsIgnoreCase(eventType)) {
                log.debug("Webhook Minut ignore (type={})", eventType);
                return;
            }

            processDisturbanceEvent(event);
        } catch (Exception e) {
            log.error("Erreur traitement webhook Minut: {}", e.getMessage(), e);
        }
    }

    private void processDisturbanceEvent(Map<String, Object> event) {
        String externalDeviceId = extractString(event, "device_id");
        if (externalDeviceId == null) {
            // Essayer dans un sous-objet "data"
            Object data = event.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                externalDeviceId = extractString(dataMap, "device_id");
            }
        }

        if (externalDeviceId == null) {
            log.warn("Webhook Minut disturbance sans device_id");
            return;
        }

        NoiseDevice device = deviceRepository.findByExternalDeviceId(externalDeviceId).orElse(null);
        if (device == null) {
            log.debug("Device Minut inconnu: {}", externalDeviceId);
            return;
        }

        double soundLevel = extractSoundLevel(event);
        if (soundLevel <= 0) {
            log.debug("Pas de niveau sonore valide dans l'evenement Minut");
            return;
        }

        log.info("Disturbance Minut: device={}, property={}, level={}dB",
            externalDeviceId, device.getPropertyId(), soundLevel);

        noiseAlertService.evaluateNoiseLevel(
            device.getOrganizationId(),
            device.getPropertyId(),
            device.getId(),
            soundLevel,
            AlertSource.WEBHOOK
        );

        // Republier l'evenement traite sur le topic noise events (pour analytics)
        try {
            Map<String, Object> processedEvent = Map.of(
                "deviceId", device.getId(),
                "propertyId", device.getPropertyId(),
                "soundLevel", soundLevel,
                "source", "MINUT_WEBHOOK",
                "timestamp", System.currentTimeMillis()
            );
            kafkaTemplate.send(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS, processedEvent);
        } catch (Exception e) {
            log.warn("Erreur publication noise event: {}", e.getMessage());
        }
    }

    private double extractSoundLevel(Map<String, Object> event) {
        // Tenter d'extraire sound_level depuis la racine ou depuis "data"
        Double level = extractDouble(event, "sound_level");
        if (level != null) return level;

        Object data = event.get("data");
        if (data instanceof Map<?, ?> dataMap) {
            level = extractDouble(dataMap, "sound_level");
            if (level != null) return level;

            level = extractDouble(dataMap, "level");
            if (level != null) return level;
        }
        return 0;
    }

    private String extractString(Map<?, ?> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private Double extractDouble(Map<?, ?> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number num) return num.doubleValue();
        if (val instanceof String str) {
            try { return Double.parseDouble(str); } catch (NumberFormatException ignored) {}
        }
        return null;
    }
}
