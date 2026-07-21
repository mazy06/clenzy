package com.clenzy.scheduler;

import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.service.yield.MinStayAutoEngine;
import com.clenzy.service.yield.OrphanGapEngine;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/**
 * Automatisations RMS R2 — 04:50, APRÈS le yield v1 (04:40, dont les prix servent
 * de base aux remises orphan gap) et AVANT le snapshot calendrier (05:30, qui
 * photographie ainsi l'état final publié du jour).
 *
 * <p>Ordre par org : orphan gap d'abord (pose ses min-stay spécifiques aux creux),
 * puis min-stay auto (qui ne touche jamais aux écritures d'une autre source).
 * Une org en échec ne bloque pas les suivantes.</p>
 */
@Component
public class RmsAutomationScheduler {

    private static final Logger log = LoggerFactory.getLogger(RmsAutomationScheduler.class);

    private final YieldOrgConfigRepository configRepository;
    private final OrphanGapEngine orphanGapEngine;
    private final MinStayAutoEngine minStayAutoEngine;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final Clock clock;

    public RmsAutomationScheduler(YieldOrgConfigRepository configRepository,
                                  OrphanGapEngine orphanGapEngine,
                                  MinStayAutoEngine minStayAutoEngine,
                                  TenantScopedExecutor tenantScopedExecutor,
                                  Clock clock) {
        this.configRepository = configRepository;
        this.orphanGapEngine = orphanGapEngine;
        this.minStayAutoEngine = minStayAutoEngine;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.clock = clock;
    }

    @Scheduled(cron = "${clenzy.rms.automation.cron:0 50 4 * * *}")
    @SchedulerLock(name = "rms-automation-daily", lockAtMostFor = "PT30M")
    public void runDaily() {
        final List<YieldOrgConfig> configs =
                configRepository.findByOrphanGapEnabledTrueOrMinStayAutoEnabledTrue();
        if (configs.isEmpty()) {
            return;
        }
        final LocalDate today = LocalDate.now(clock);
        log.info("Automatisations RMS : run du {} — {} org(s)", today, configs.size());
        for (YieldOrgConfig config : configs) {
            final Long orgId = config.getOrganizationId();
            try {
                tenantScopedExecutor.runAsOrganization(orgId, () -> {
                    if (config.isOrphanGapEnabled()) {
                        orphanGapEngine.evaluateOrganization(config, today);
                    }
                    if (config.isMinStayAutoEnabled()) {
                        minStayAutoEngine.evaluateOrganization(config, today);
                    }
                });
            } catch (Exception e) {
                log.error("Automatisations RMS : échec org={} : {}", orgId, e.getMessage());
            }
        }
    }
}
