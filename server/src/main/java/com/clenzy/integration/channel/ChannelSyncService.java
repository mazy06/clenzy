package com.clenzy.integration.channel;

import com.clenzy.config.KafkaConfig;
import com.clenzy.config.SyncMetrics;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Service d'orchestration de la synchronisation multi-channel.
 *
 * Consomme les events du topic {@code calendar.updates} (emis par CalendarEngine
 * via OutboxRelay) et les propage vers tous les channels connectes a la propriete.
 *
 * Flow :
 * 1. CalendarEngine modifie le calendrier
 * 2. OutboxPublisher insere un event dans outbox_events (meme transaction)
 * 3. OutboxRelay publie l'event sur Kafka topic calendar.updates
 * 4. ChannelSyncService consomme l'event
 * 5. Resout tous les channels connectes a la propriete
 * 6. Appelle pushCalendarUpdate() sur chaque channel qui supporte OUTBOUND_CALENDAR
 * 7. Log le resultat dans channel_sync_log
 */
@Service
public class ChannelSyncService {

    private static final Logger log = LoggerFactory.getLogger(ChannelSyncService.class);

    private final ChannelConnectorRegistry connectorRegistry;
    private final ChannelMappingRepository channelMappingRepository;
    private final ChannelSyncLogRepository syncLogRepository;
    private final ObjectMapper objectMapper;
    private final SyncMetrics syncMetrics;

    public ChannelSyncService(ChannelConnectorRegistry connectorRegistry,
                              ChannelMappingRepository channelMappingRepository,
                              ChannelSyncLogRepository syncLogRepository,
                              ObjectMapper objectMapper,
                              SyncMetrics syncMetrics) {
        this.connectorRegistry = connectorRegistry;
        this.channelMappingRepository = channelMappingRepository;
        this.syncLogRepository = syncLogRepository;
        this.objectMapper = objectMapper;
        this.syncMetrics = syncMetrics;
    }

    /**
     * Consumer Kafka pour les events calendrier emis par le CalendarEngine
     * via OutboxRelay.
     *
     * IMPORTANT : OutboxRelay envoie event.getPayload() (un String JSON brut)
     * via KafkaTemplate<String, Object> + JsonSerializer.
     * Le JsonSerializer double-serialise le String (l'enveloppe dans des quotes).
     * Le JsonDeserializer cote consumer renvoie donc un String, pas un Map.
     * On accepte String et on parse manuellement avec ObjectMapper.
     */
    @SuppressWarnings("unchecked")
    @Transactional
    @KafkaListener(topics = KafkaConfig.TOPIC_CALENDAR_UPDATES, groupId = "clenzy-channel-sync")
    public void onCalendarUpdate(String rawPayload) {
        try {
            Map<String, Object> event = objectMapper.readValue(rawPayload, Map.class);

            Long propertyId = extractLong(event, "propertyId");
            Long orgId = extractLong(event, "orgId");
            String action = (String) event.get("action");
            LocalDate from = parseDate(event, "from");
            LocalDate to = parseDate(event, "to");

            if (propertyId == null || orgId == null) {
                log.warn("ChannelSyncService: event incomplet, propertyId={}, orgId={}", propertyId, orgId);
                return;
            }

            log.debug("ChannelSyncService: event calendrier recu action={} propertyId={} [{}, {})",
                    action, propertyId, from, to);

            // Resoudre tous les mappings actifs pour cette propriete
            List<ChannelMapping> mappings = channelMappingRepository.findActiveByPropertyId(propertyId, orgId);

            if (mappings.isEmpty()) {
                log.debug("ChannelSyncService: aucun mapping actif pour propriete {}, skip", propertyId);
                return;
            }

            // Determiner la capability cible selon l'action
            boolean isRestrictionEvent = "RESTRICTION_UPDATED".equals(action)
                    || "RESTRICTION_CREATED".equals(action)
                    || "RESTRICTION_DELETED".equals(action);

            // Fan-out vers chaque channel connecte
            String syncId = UUID.randomUUID().toString();
            MDC.put("syncId", syncId);
            try {
                for (ChannelMapping mapping : mappings) {
                    ChannelConnection connection = mapping.getConnection();
                    ChannelName channelName = connection.getChannel();

                    connectorRegistry.getConnector(channelName).ifPresent(connector -> {
                        if (from == null || to == null) return;

                        // Pour les events restriction, fan-out vers OUTBOUND_RESTRICTIONS
                        if (isRestrictionEvent && connector.supports(ChannelCapability.OUTBOUND_RESTRICTIONS)) {
                            MDC.put("channel", channelName.toString());
                            long startMs = System.currentTimeMillis();
                            SyncResult result;
                            try {
                                result = connector.pushRestrictions(propertyId, from, to, orgId);
                                long elapsed = System.currentTimeMillis() - startMs;
                                syncMetrics.recordSyncSuccess(channelName.toString(),
                                        result.getDurationMs() > 0 ? result.getDurationMs() : elapsed);
                            } catch (Exception e) {
                                long elapsed = System.currentTimeMillis() - startMs;
                                result = SyncResult.failed(e.getMessage(), elapsed);
                                syncMetrics.recordSyncFailure(channelName.toString(),
                                        e.getClass().getSimpleName(), elapsed);
                                log.error("ChannelSyncService: erreur push restrictions {} pour propriete {}: {}",
                                        channelName, propertyId, e.getMessage());
                            } finally {
                                MDC.remove("channel");
                            }

                            logSync(connection, mapping, SyncDirection.OUTBOUND, action, result);
                            log.info("ChannelSyncService: push restrictions {} propriete {} → {} ({})",
                                    channelName, propertyId, result.getStatus(), result.getMessage());
                        }

                        // Pour les events calendrier classiques, fan-out vers OUTBOUND_CALENDAR
                        if (!isRestrictionEvent && connector.supports(ChannelCapability.OUTBOUND_CALENDAR)) {
                            MDC.put("channel", channelName.toString());
                            long startMs = System.currentTimeMillis();
                            SyncResult result;
                            try {
                                result = connector.pushCalendarUpdate(propertyId, from, to, orgId);
                                long elapsed = System.currentTimeMillis() - startMs;
                                syncMetrics.recordSyncSuccess(channelName.toString(),
                                        result.getDurationMs() > 0 ? result.getDurationMs() : elapsed);
                            } catch (Exception e) {
                                long elapsed = System.currentTimeMillis() - startMs;
                                result = SyncResult.failed(e.getMessage(), elapsed);
                                syncMetrics.recordSyncFailure(channelName.toString(),
                                        e.getClass().getSimpleName(), elapsed);
                                log.error("ChannelSyncService: erreur push {} pour propriete {}: {}",
                                        channelName, propertyId, e.getMessage());
                            } finally {
                                MDC.remove("channel");
                            }

                            logSync(connection, mapping, SyncDirection.OUTBOUND, action, result);
                            log.info("ChannelSyncService: push {} propriete {} → {} ({})",
                                    channelName, propertyId, result.getStatus(), result.getMessage());
                        }
                    });
                }
            } finally {
                MDC.remove("syncId");
            }

        } catch (Exception e) {
            log.error("ChannelSyncService: erreur traitement event calendrier: {}", e.getMessage(), e);
        }
    }

    /**
     * Synchronisation manuelle d'une propriete vers tous ses channels connectes.
     *
     * @param propertyId propriete PMS
     * @param from       debut de la plage (inclus)
     * @param to         fin de la plage (exclus)
     * @param orgId      organisation
     * @return resultats par channel
     */
    public Map<ChannelName, SyncResult> syncProperty(Long propertyId, LocalDate from,
                                                       LocalDate to, Long orgId) {
        Map<ChannelName, SyncResult> results = new LinkedHashMap<>();

        List<ChannelMapping> mappings = channelMappingRepository.findActiveByPropertyId(propertyId, orgId);

        for (ChannelMapping mapping : mappings) {
            ChannelConnection connection = mapping.getConnection();
            ChannelName channelName = connection.getChannel();

            ChannelConnector connector = connectorRegistry.getConnector(channelName).orElse(null);
            if (connector == null) {
                results.put(channelName, SyncResult.failed("Connecteur non enregistre: " + channelName));
                continue;
            }

            if (!connector.supports(ChannelCapability.OUTBOUND_CALENDAR)) {
                results.put(channelName, SyncResult.skipped("Channel ne supporte pas OUTBOUND_CALENDAR"));
                continue;
            }

            long startMs = System.currentTimeMillis();
            SyncResult result;
            try {
                result = connector.pushCalendarUpdate(propertyId, from, to, orgId);
            } catch (Exception e) {
                long elapsed = System.currentTimeMillis() - startMs;
                result = SyncResult.failed(e.getMessage(), elapsed);
            }

            logSync(connection, mapping, SyncDirection.OUTBOUND, "MANUAL_SYNC", result);
            results.put(channelName, result);
        }

        return results;
    }

    /**
     * Log une operation de sync dans channel_sync_log.
     * Package-private : utilise uniquement par les ChannelConnector du meme package.
     */
    void logSync(ChannelConnection connection, ChannelMapping mapping,
                 SyncDirection direction, String eventType, SyncResult result) {
        try {
            ChannelSyncLog syncLog = new ChannelSyncLog(
                    connection.getOrganizationId(),
                    connection,
                    direction,
                    eventType != null ? eventType : "UNKNOWN",
                    result.getStatus().name()
            );
            syncLog.setMapping(mapping);
            syncLog.setDetails(result.getMessage());
            if (result.isFailed()) {
                syncLog.setErrorMessage(result.getMessage());
            }
            syncLog.setDurationMs(result.getDurationMs() > 0 ? (int) result.getDurationMs() : null);

            syncLogRepository.save(syncLog);
        } catch (Exception e) {
            log.error("ChannelSyncService: erreur sauvegarde sync log: {}", e.getMessage());
        }
    }

    // ---- Helpers ----

    private Long extractLong(Map<String, Object> event, String key) {
        Object value = event.get(key);
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private LocalDate parseDate(Map<String, Object> event, String key) {
        Object value = event.get(key);
        if (value == null) return null;
        try {
            return LocalDate.parse(value.toString());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
