package com.clenzy.integration.channel;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Source evenementielle des flux deterministes (fiche 08, vague 2) : ecoute les
 * mises a jour de calendrier ({@code calendar.updates}) et relaie les evenements
 * BOOKED / CANCELLED vers le moteur AutomationRule central via
 * {@link AutomationEngine#fireTrigger}.
 *
 * <p><b>Mince par conception</b> : aucune logique metier ici — le moteur evalue
 * les regles actives de l'organisation (opt-in = existence d'une regle active),
 * applique l'idempotence generique (regle x sujet) et route vers les executeurs
 * (ex. CREATE_CLEANING_REQUEST, CANCEL_LINKED_CLEANING_REQUEST).</p>
 *
 * <p><b>Additif</b> : consumer group dedie ({@code clenzy-deterministic-flows}),
 * independant des autres consommateurs du topic (ChannelSyncService,
 * ChannexSyncService, SupervisionCalendarTriggerListener). Payload identique
 * (cf. {@code CalendarEngine.buildPayload}) : action / propertyId / orgId /
 * from / to / reservationId.</p>
 *
 * <p>Un payload malforme ou incomplet est ignore (log) ; un echec du moteur
 * remonte au conteneur Kafka (retry / DLT) — l'idempotence generique et les cles
 * metier des executeurs rendent la re-livraison sure.</p>
 */
@Component
public class DeterministicFlowListener {

    private static final Logger log = LoggerFactory.getLogger(DeterministicFlowListener.class);

    static final String ACTION_BOOKED = "BOOKED";
    static final String ACTION_CANCELLED = "CANCELLED";

    private final AutomationEngine automationEngine;
    private final ObjectMapper objectMapper;

    public DeterministicFlowListener(AutomationEngine automationEngine, ObjectMapper objectMapper) {
        this.automationEngine = automationEngine;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_CALENDAR_UPDATES, groupId = "clenzy-deterministic-flows")
    public void onCalendarUpdate(Object payload) {
        Map<String, Object> event = coerceToMap(payload);
        if (event == null) {
            log.debug("Flux deterministes: payload calendrier de type {} non exploitable — ignore",
                    payload != null ? payload.getClass().getName() : "null");
            return;
        }
        log.debug("Flux deterministes: event calendrier recu action={} orgId={} propertyId={} reservationId={}",
                event.get("action"), event.get("orgId"), event.get("propertyId"), event.get("reservationId"));

        Object action = event.get("action");
        if (action == null) {
            return;
        }
        AutomationTrigger trigger = switch (action.toString()) {
            case ACTION_BOOKED -> AutomationTrigger.RESERVATION_BOOKED;
            case ACTION_CANCELLED -> AutomationTrigger.RESERVATION_CANCELLED;
            default -> null;
        };
        if (trigger == null) {
            return;
        }

        Long orgId = asLong(event.get("orgId"));
        Long propertyId = asLong(event.get("propertyId"));
        Long reservationId = asLong(event.get("reservationId"));
        if (orgId == null || propertyId == null) {
            log.debug("Flux deterministes: event {} sans orgId/propertyId — ignore", action);
            return;
        }
        if (reservationId == null) {
            // Le sujet d'idempotence du moteur est la reservation : sans elle un
            // BOOKED re-dedupliquerait toutes les resas futures de la propriete.
            // Le filet quotidien (CleaningBackfillScheduler) rattrape ces cas.
            log.info("Flux deterministes: event {} propriete {} sans reservationId — delegue au filet quotidien",
                    action, propertyId);
            return;
        }

        Map<String, Object> data = new HashMap<>();
        data.put(AutomationSubject.DATA_PROPERTY_ID, propertyId);
        data.put(AutomationSubject.DATA_RESERVATION_ID, reservationId);
        putIfPresent(data, AutomationSubject.DATA_CHECK_IN, event.get("from"));
        putIfPresent(data, AutomationSubject.DATA_CHECK_OUT, event.get("to"));

        automationEngine.fireTrigger(trigger, orgId,
                new AutomationSubject(AutomationSubject.TYPE_RESERVATION, reservationId, data));
    }

    private static void putIfPresent(Map<String, Object> data, String key, Object value) {
        if (value != null && !value.toString().isBlank()) {
            data.put(key, value.toString());
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
                log.warn("Flux deterministes: payload calendrier illisible — ignore ({})", e.getMessage());
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
