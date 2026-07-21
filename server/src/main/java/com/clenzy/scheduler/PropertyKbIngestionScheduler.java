package com.clenzy.scheduler;

import com.clenzy.booking.service.PropertyKbIngestionService;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.AiTokenBudgetService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

/**
 * Ingestion auto des hébergements dans la KB (2.13) : chaque jour, ré-indexe les hébergements des
 * orgs ayant activé l'IA conversationnelle (le concierge s'appuie dessus). Gating sur la feature
 * {@code ASSISTANT_CHAT} → seules les orgs qui utilisent le concierge paient le coût d'embedding.
 * Délégation au service (scheduler mince). Best-effort : un échec org n'interrompt pas le batch.
 */
@Component
public class PropertyKbIngestionScheduler {

    private static final Logger log = LoggerFactory.getLogger(PropertyKbIngestionScheduler.class);

    private final OrganizationRepository organizationRepository;
    private final AiTokenBudgetService tokenBudgetService;
    private final PropertyKbIngestionService propertyKbIngestionService;

    public PropertyKbIngestionScheduler(OrganizationRepository organizationRepository,
                                        AiTokenBudgetService tokenBudgetService,
                                        PropertyKbIngestionService propertyKbIngestionService) {
        this.organizationRepository = organizationRepository;
        this.tokenBudgetService = tokenBudgetService;
        this.propertyKbIngestionService = propertyKbIngestionService;
    }

    /** Tous les jours à 05:15 (après le crédit fidélité 04:45). */
    @Scheduled(cron = "0 15 5 * * *")
    @SchedulerLock(name = "property-kb-ingestion", lockAtMostFor = "PT30M")
    public void reindexProperties() {
        int reindexed = 0;
        for (Organization org : organizationRepository.findAll()) {
            final Long orgId = org.getId();
            if (orgId == null || !tokenBudgetService.isFeatureEnabled(orgId, AiFeature.ASSISTANT_CHAT)) {
                continue;
            }
            try {
                if (propertyKbIngestionService.ingestForOrg(orgId)) {
                    reindexed++;
                }
            } catch (RuntimeException e) {
                log.warn("KB auto-ingest hébergements : échec org={} ({})", orgId, e.getMessage());
            }
        }
        if (reindexed > 0) {
            log.info("KB auto-ingest hébergements : {} org(s) ré-indexée(s)", reindexed);
        }
    }
}
