package com.clenzy.integration.channel;

import com.clenzy.config.KafkaConfig;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * Source event-driven de la boucle autonome : écoute les mises à jour de
 * calendrier ({@code calendar.updates}) et marque le logement « dirty » quand
 * une réservation est posée/annulée → le {@code SupervisionAutonomousScanner}
 * le scannera au prochain cycle.
 *
 * <p><b>Additif</b> : consumer group dédié, indépendant des consommateurs
 * existants du topic (ChannelSyncService, ChannexSyncService). Ne touche aucun
 * service cœur.</p>
 *
 * <p>Best-effort : un échec de marquage est avalé (log debug) et ne renvoie PAS
 * le message au DLT — un raté de déclenchement de scan n'est pas une erreur de
 * traitement du calendrier (déviation justifiée à la règle « pas de catch
 * avaleur » : ici l'effet est une optimisation non critique).</p>
 */
@Component
public class SupervisionCalendarTriggerListener {

    private static final Logger log = LoggerFactory.getLogger(SupervisionCalendarTriggerListener.class);

    /** Actions calendrier qui justifient un scan (nouvelle résa / annulation). */
    private static final Set<String> TRIGGER_ACTIONS = Set.of("BOOKED", "CANCELLED");

    private final SupervisionTriggerService triggerService;
    private final ObjectMapper objectMapper;

    public SupervisionCalendarTriggerListener(SupervisionTriggerService triggerService,
                                              ObjectMapper objectMapper) {
        this.triggerService = triggerService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_CALENDAR_UPDATES, groupId = "clenzy-supervision-trigger")
    public void onCalendarUpdate(Object payload) {
        try {
            Map<String, Object> event = coerceToMap(payload);
            if (event == null) {
                return;
            }
            Object action = event.get("action");
            if (action == null || !TRIGGER_ACTIONS.contains(action.toString())) {
                return;
            }
            Long orgId = asLong(event.get("orgId"));
            Long propertyId = asLong(event.get("propertyId"));
            if (orgId == null || propertyId == null) {
                return;
            }
            triggerService.markDirty(orgId, propertyId);
        } catch (Exception e) {
            log.debug("Supervision trigger: event calendrier ignoré ({})", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> coerceToMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        if (payload instanceof org.apache.kafka.clients.consumer.ConsumerRecord<?, ?> consumerRecord) {
            // Avec un parametre @KafkaListener de type Object, Spring Kafka passe le
            // ConsumerRecord ENTIER (pas sa value) : sans cet unwrap, TOUS les events
            // etaient silencieusement ignores (bug reel attrape par KafkaFlowIT,
            // 2026-07-03 — meme unwrap que ChannelSyncService.coerceToEventMap).
            return coerceToMap(consumerRecord.value());
        }
        if (payload instanceof String s && !s.isBlank()) {
            try {
                return objectMapper.readValue(s, Map.class);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private static Long asLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
