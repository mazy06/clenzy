package com.clenzy.service;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.repository.YieldRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Scheduler de yield management.
 *
 * Evalue periodiquement les regles de yield pour toutes les proprietes
 * qui ont des regles actives. Ajuste les prix via AdvancedRateManager
 * et log les modifications dans rate_audit_log.
 *
 * Active uniquement si clenzy.yield.scheduler.enabled=true.
 * Frequence par defaut : toutes les heures.
 */
@Service
@ConditionalOnProperty(name = "clenzy.yield.scheduler.enabled", havingValue = "true")
public class YieldManagementScheduler {

    private static final Logger log = LoggerFactory.getLogger(YieldManagementScheduler.class);

    private final AdvancedRateManager advancedRateManager;
    private final YieldRuleRepository yieldRuleRepository;
    private final ChannelMappingRepository channelMappingRepository;

    public YieldManagementScheduler(AdvancedRateManager advancedRateManager,
                                    YieldRuleRepository yieldRuleRepository,
                                    ChannelMappingRepository channelMappingRepository) {
        this.advancedRateManager = advancedRateManager;
        this.yieldRuleRepository = yieldRuleRepository;
        this.channelMappingRepository = channelMappingRepository;
    }

    /**
     * Evaluation periodique des regles de yield.
     * Parcourt toutes les proprietes avec des mappings actifs
     * et applique les regles de yield pertinentes.
     */
    @Scheduled(cron = "${clenzy.yield.scheduler.cron:0 0 * * * *}")
    public void evaluateYieldRules() {
        log.info("Demarrage evaluation periodique des regles de yield");

        long startMs = System.currentTimeMillis();
        int propertiesProcessed = 0;
        int errors = 0;

        try {
            // Collecter les proprietes uniques depuis les mappings actifs
            List<ChannelMapping> activeMappings = channelMappingRepository.findAllActiveCrossOrg();

            Set<PropertyOrg> processedProperties = new HashSet<>();
            for (ChannelMapping mapping : activeMappings) {
                Long propertyId = mapping.getInternalId();
                Long orgId = mapping.getOrganizationId();
                PropertyOrg key = new PropertyOrg(propertyId, orgId);

                if (!processedProperties.add(key)) continue;

                try {
                    advancedRateManager.applyYieldRules(propertyId, orgId);
                    propertiesProcessed++;
                } catch (Exception e) {
                    errors++;
                    log.error("Erreur yield rules property={} org={}: {}",
                            propertyId, orgId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Erreur fatale evaluation yield rules: {}", e.getMessage(), e);
        }

        long elapsed = System.currentTimeMillis() - startMs;
        log.info("Evaluation yield rules terminee : {} proprietes, {} erreurs, {}ms",
                propertiesProcessed, errors, elapsed);
    }

    /**
     * Evaluation manuelle pour une propriete specifique.
     * Appele depuis le controller (endpoint POST /yield-rules/evaluate/{propertyId}).
     */
    public void evaluateForProperty(Long propertyId, Long orgId) {
        log.info("Evaluation manuelle yield rules pour property={}", propertyId);
        advancedRateManager.applyYieldRules(propertyId, orgId);
    }

    /**
     * Cle composite pour deduplication property + org.
     */
    private record PropertyOrg(Long propertyId, Long orgId) {}
}
