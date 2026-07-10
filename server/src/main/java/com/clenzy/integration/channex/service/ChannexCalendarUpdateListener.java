package com.clenzy.integration.channex.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Listener Kafka des events {@code calendar.updates} pour Channex.
 *
 * <p>Volontairement LEGER : il ne fait AUCUN appel API Channex — il parse
 * l'event, verifie qu'un mapping actif existe (1 lecture DB) et enfile la
 * plage dans {@link ChannexAriBatcher}. C'est le batcher qui agrege par
 * propriete (fenetre 30-60 s) et pousse dans les limites de debit Channex
 * (exigence de certification : jamais un appel API par evenement).</p>
 *
 * <p>Un payload JSON illisible se PROPAGE : DefaultErrorHandler Kafka rejoue
 * (backoff) puis route vers la DLT {@code calendar.updates.DLT} — jamais
 * d'avalage silencieux (audit #7).</p>
 */
@Component
public class ChannexCalendarUpdateListener {

    private static final Logger log = LoggerFactory.getLogger(ChannexCalendarUpdateListener.class);
    private static final String KAFKA_GROUP_ID = "clenzy-channex-sync";

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexAriBatcher ariBatcher;
    private final ObjectMapper objectMapper;

    public ChannexCalendarUpdateListener(ChannexPropertyMappingRepository mappingRepository,
                                         ChannexAriBatcher ariBatcher,
                                         ObjectMapper objectMapper) {
        this.mappingRepository = mappingRepository;
        this.ariBatcher = ariBatcher;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_CALENDAR_UPDATES, groupId = KAFKA_GROUP_ID)
    public void onCalendarUpdate(Object payload) {
        Map<String, Object> event = unwrapPayload(payload);
        if (event == null) return;

        Long propertyId = extractLong(event, "propertyId");
        Long orgId = extractLong(event, "orgId");
        LocalDate from = parseDate(event, "from");
        LocalDate to = parseDate(event, "to");

        if (propertyId == null || orgId == null || from == null || to == null) {
            log.debug("ChannexListener: event incomplet, skip (propertyId={}, orgId={}, from={}, to={})",
                propertyId, orgId, from, to);
            return;
        }

        // Filtre a l'entree : ne remplir le batcher que pour les proprietes
        // effectivement gerees par Channex (mapping actif). Les checks couteux
        // (routage natif, OTA actif — appel API) restent au flush.
        Optional<ChannexPropertyMapping> mapping =
            mappingRepository.findByClenzyPropertyId(propertyId, orgId);
        if (mapping.isEmpty() || mapping.get().getSyncStatus() == ChannexSyncStatus.DISABLED) {
            return;
        }

        ariBatcher.enqueue(propertyId, orgId, from, to);
    }

    // ─── Payload helpers (factorises avec ChannelSyncService) ───────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> unwrapPayload(Object payload) {
        if (payload instanceof Map) return (Map<String, Object>) payload;
        try {
            if (payload instanceof ConsumerRecord<?, ?> record) {
                Object value = record.value();
                if (value instanceof Map) return (Map<String, Object>) value;
                if (value instanceof String s) return objectMapper.readValue(s, Map.class);
            }
            if (payload instanceof String s) return objectMapper.readValue(s, Map.class);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            // Payload JSON illisible = erreur de traitement -> propagee (retry Kafka -> DLT, audit #7)
            throw new IllegalStateException("ChannexListener: payload JSON illisible", e);
        }
        log.debug("ChannexListener: payload type inattendu {}, skip",
            payload != null ? payload.getClass().getName() : "null");
        return null;
    }

    private static Long extractLong(Map<String, Object> event, String key) {
        Object v = event.get(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static LocalDate parseDate(Map<String, Object> event, String key) {
        Object v = event.get(key);
        if (v == null) return null;
        if (v instanceof LocalDate d) return d;
        if (v instanceof String s) {
            try { return LocalDate.parse(s); } catch (DateTimeParseException ignored) { return null; }
        }
        return null;
    }
}
