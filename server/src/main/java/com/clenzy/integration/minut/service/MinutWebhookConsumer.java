package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseDevice;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.NotifyStaffExecutor;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Consumer Kafka pour les webhooks Minut :
 * <ul>
 *   <li>"disturbance" — evalue le niveau de bruit via NoiseAlertService ;</li>
 *   <li>"device_offline" / "device_online" (F7b) — borne l'episode hors-ligne
 *       (CAS sur {@code NoiseDevice.online}) et tire le trigger
 *       {@code IOT_DEVICE_OFFLINE} du moteur AutomationRule au DEBUT d'episode
 *       uniquement. Pas de debounce local : l'evenement device_offline est emis
 *       par le cloud Minut apres absence prolongee de heartbeat du capteur (la
 *       detection est deja debouncee cote Minut, ce n'est pas un blip reseau).</li>
 * </ul>
 */
@Service
public class MinutWebhookConsumer {

    private static final Logger log = LoggerFactory.getLogger(MinutWebhookConsumer.class);

    private final ObjectMapper objectMapper;
    private final NoiseDeviceRepository deviceRepository;
    private final NoiseAlertService noiseAlertService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final AutomationEngine automationEngine;

    public MinutWebhookConsumer(ObjectMapper objectMapper,
                                 NoiseDeviceRepository deviceRepository,
                                 NoiseAlertService noiseAlertService,
                                 KafkaTemplate<String, Object> kafkaTemplate,
                                 AutomationEngine automationEngine) {
        this.objectMapper = objectMapper;
        this.deviceRepository = deviceRepository;
        this.noiseAlertService = noiseAlertService;
        this.kafkaTemplate = kafkaTemplate;
        this.automationEngine = automationEngine;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_MINUT_WEBHOOKS, groupId = "clenzy-minut-noise")
    public void handleMinutWebhook(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(
                payload, new TypeReference<Map<String, Object>>() {});

            String eventType = extractString(event, "event_type");
            if ("disturbance".equalsIgnoreCase(eventType)) {
                processDisturbanceEvent(event);
            } else if ("device_offline".equalsIgnoreCase(eventType)) {
                processDeviceOfflineEvent(event);
            } else if ("device_online".equalsIgnoreCase(eventType)) {
                processDeviceOnlineEvent(event);
            } else {
                log.debug("Webhook Minut ignore (type={})", eventType);
            }
        } catch (Exception e) {
            log.error("Erreur traitement webhook Minut: {}", e.getMessage(), e);
        }
    }

    private void processDisturbanceEvent(Map<String, Object> event) {
        NoiseDevice device = resolveDevice(event, "disturbance");
        if (device == null) {
            return;
        }

        double soundLevel = extractSoundLevel(event);
        if (soundLevel <= 0) {
            log.debug("Pas de niveau sonore valide dans l'evenement Minut");
            return;
        }

        log.info("Disturbance Minut: device={}, property={}, level={}dB",
            device.getExternalDeviceId(), device.getPropertyId(), soundLevel);

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

    /**
     * F7b — debut d'episode hors-ligne : CAS {@code online → offline} sur le device
     * (une re-livraison Kafka ou un second webhook offline du meme episode ne
     * matche pas → un seul declenchement par episode), puis trigger
     * {@code IOT_DEVICE_OFFLINE} vers le moteur (regle recommandee : NOTIFY_STAFF).
     * Limite assumee : signal offline explicite cote Minut uniquement (Nuki n'en
     * publie pas dans nos webhooks).
     */
    private void processDeviceOfflineEvent(Map<String, Object> event) {
        NoiseDevice device = resolveDevice(event, "device_offline");
        if (device == null) {
            return;
        }
        if (deviceRepository.markOffline(device.getId()) == 0) {
            log.debug("Device Minut {} deja hors ligne (episode en cours) — pas de re-notification",
                device.getId());
            return;
        }

        // Pas de valeur null dans data (le contexte moteur copie via Map.copyOf).
        Map<String, Object> data = new HashMap<>();
        data.put("deviceId", device.getId());
        if (device.getName() != null) {
            data.put(NotifyStaffExecutor.DATA_DEVICE_NAME, device.getName());
        }
        if (device.getPropertyId() != null) {
            data.put(AutomationSubject.DATA_PROPERTY_ID, device.getPropertyId());
        }
        data.put(NotifyStaffExecutor.DATA_OFFLINE_SINCE, LocalDateTime.now().toString());

        log.info("Device Minut {} hors ligne (property={}) — trigger IOT_DEVICE_OFFLINE",
            device.getId(), device.getPropertyId());
        automationEngine.fireTrigger(AutomationTrigger.IOT_DEVICE_OFFLINE,
            device.getOrganizationId(),
            new AutomationSubject(AutomationSubject.TYPE_IOT_DEVICE, device.getId(), data));
    }

    /** F7b — retour en ligne : clot l'episode (le prochain offline re-notifiera). */
    private void processDeviceOnlineEvent(Map<String, Object> event) {
        NoiseDevice device = resolveDevice(event, "device_online");
        if (device == null) {
            return;
        }
        deviceRepository.markOnline(device.getId(), LocalDateTime.now());
        log.info("Device Minut {} de retour en ligne (episode hors-ligne clos)", device.getId());
    }

    /** Resout le NoiseDevice de l'evenement (device_id a la racine ou dans "data"). */
    private NoiseDevice resolveDevice(Map<String, Object> event, String eventLabel) {
        String externalDeviceId = extractString(event, "device_id");
        if (externalDeviceId == null) {
            Object data = event.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                externalDeviceId = extractString(dataMap, "device_id");
            }
        }
        if (externalDeviceId == null) {
            log.warn("Webhook Minut {} sans device_id", eventLabel);
            return null;
        }
        NoiseDevice device = deviceRepository.findByExternalDeviceId(externalDeviceId).orElse(null);
        if (device == null) {
            log.debug("Device Minut inconnu: {}", externalDeviceId);
        }
        return device;
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
