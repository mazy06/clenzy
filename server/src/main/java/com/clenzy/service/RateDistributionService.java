package com.clenzy.service;

import com.clenzy.integration.channel.*;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.RateAuditLog;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateAuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Service de distribution des tarifs vers les channels connectes.
 *
 * Pour chaque channel connecte a une propriete :
 * 1. Resout le prix channel-specific via AdvancedRateManager
 * 2. Pousse la mise a jour via ChannelConnector
 * 3. Log le resultat dans rate_audit_log
 *
 * Supporte la distribution synchrone et asynchrone (via Kafka).
 */
@Service
public class RateDistributionService {

    private static final Logger log = LoggerFactory.getLogger(RateDistributionService.class);

    private final AdvancedRateManager advancedRateManager;
    private final ChannelConnectorRegistry connectorRegistry;
    private final ChannelMappingRepository channelMappingRepository;
    private final PropertyRepository propertyRepository;
    private final RateAuditLogRepository rateAuditLogRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public RateDistributionService(AdvancedRateManager advancedRateManager,
                                   ChannelConnectorRegistry connectorRegistry,
                                   ChannelMappingRepository channelMappingRepository,
                                   PropertyRepository propertyRepository,
                                   RateAuditLogRepository rateAuditLogRepository,
                                   KafkaTemplate<String, Object> kafkaTemplate,
                                   ObjectMapper objectMapper) {
        this.advancedRateManager = advancedRateManager;
        this.connectorRegistry = connectorRegistry;
        this.channelMappingRepository = channelMappingRepository;
        this.propertyRepository = propertyRepository;
        this.rateAuditLogRepository = rateAuditLogRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Distribue les tarifs resolus vers tous les channels connectes.
     *
     * @param propertyId propriete cible
     * @param from       debut de la plage (inclus)
     * @param to         fin de la plage (exclus)
     * @param orgId      organisation
     * @return resultats par channel
     */
    @Transactional
    public Map<ChannelName, SyncResult> distributeRates(Long propertyId, LocalDate from,
                                                         LocalDate to, Long orgId) {
        Map<ChannelName, SyncResult> results = new LinkedHashMap<>();

        List<ChannelMapping> mappings = channelMappingRepository.findActiveByPropertyId(propertyId, orgId);
        if (mappings.isEmpty()) {
            log.debug("Aucun mapping actif pour property={}, skip distribution", propertyId);
            return results;
        }

        for (ChannelMapping mapping : mappings) {
            ChannelName channelName = mapping.getConnection().getChannel();
            SyncResult result = distributeToChannel(propertyId, from, to, channelName, orgId);
            results.put(channelName, result);
        }

        return results;
    }

    /**
     * Distribution en masse pour toutes les proprietes d'une organisation.
     */
    @Transactional
    public void distributeRatesForAllProperties(Long orgId, LocalDate from, LocalDate to) {
        List<Long> propertyIds = propertyRepository.findIdsByOwnerKeycloakId(null, orgId);
        // Fallback : utiliser les mappings actifs pour trouver les proprietes
        List<ChannelMapping> allMappings = channelMappingRepository.findAllActiveCrossOrg();

        Set<Long> processedProperties = new HashSet<>();
        for (ChannelMapping mapping : allMappings) {
            Long propId = mapping.getInternalId();
            if (mapping.getOrganizationId().equals(orgId) && processedProperties.add(propId)) {
                try {
                    distributeRates(propId, from, to, orgId);
                } catch (Exception e) {
                    log.error("Erreur distribution tarifs property={}: {}", propId, e.getMessage());
                }
            }
        }

        log.info("Distribution complete pour {} proprietes, org={}", processedProperties.size(), orgId);
    }

    /**
     * Publication d'un event Kafka pour distribution asynchrone.
     */
    public void scheduleRateDistribution(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        try {
            Map<String, Object> event = Map.of(
                    "action", "RATE_DISTRIBUTION",
                    "propertyId", propertyId,
                    "from", from.toString(),
                    "to", to.toString(),
                    "orgId", orgId
            );
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send("calendar.updates", String.valueOf(propertyId), payload);
            log.debug("Event distribution tarifs publie pour property={} [{}, {})", propertyId, from, to);
        } catch (Exception e) {
            log.error("Erreur publication event distribution tarifs property={}: {}",
                    propertyId, e.getMessage());
        }
    }

    // ── Methodes privees ────────────────────────────────────────────────────

    private SyncResult distributeToChannel(Long propertyId, LocalDate from,
                                           LocalDate to, ChannelName channelName, Long orgId) {
        ChannelConnector connector = connectorRegistry.getConnector(channelName).orElse(null);
        if (connector == null) {
            return SyncResult.failed("Connecteur non enregistre: " + channelName);
        }

        if (!connector.supports(ChannelCapability.OUTBOUND_CALENDAR)) {
            return SyncResult.skipped("Channel ne supporte pas OUTBOUND_CALENDAR");
        }

        long startMs = System.currentTimeMillis();
        try {
            // Resoudre les prix channel-specific pour la plage
            Map<LocalDate, BigDecimal> channelPrices = advancedRateManager
                    .resolveChannelPriceRange(propertyId, from, to, channelName, orgId);

            // Pousser la mise a jour calendrier (inclut les prix)
            SyncResult result = connector.pushCalendarUpdate(propertyId, from, to, orgId);

            long elapsed = System.currentTimeMillis() - startMs;
            logDistribution(propertyId, channelName, result, orgId);

            log.info("Distribution tarifs property={} channel={} : {} ({}ms)",
                    propertyId, channelName, result.getStatus(), elapsed);

            return result;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startMs;
            SyncResult failResult = SyncResult.failed(e.getMessage(), elapsed);
            logDistribution(propertyId, channelName, failResult, orgId);
            log.error("Erreur distribution tarifs property={} channel={}: {}",
                    propertyId, channelName, e.getMessage());
            return failResult;
        }
    }

    private void logDistribution(Long propertyId, ChannelName channelName,
                                 SyncResult result, Long orgId) {
        try {
            RateAuditLog auditLog = new RateAuditLog();
            auditLog.setOrganizationId(orgId);
            auditLog.setPropertyId(propertyId);
            auditLog.setDate(LocalDate.now());
            auditLog.setSource("CHANNEL_SYNC");
            auditLog.setChannelName(channelName.name());
            auditLog.setChangedBy("SYSTEM");
            auditLog.setNewValue(result.getStatus().name() + ": " + result.getMessage());
            rateAuditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Erreur sauvegarde audit log distribution: {}", e.getMessage());
        }
    }
}
