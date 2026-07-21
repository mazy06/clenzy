package com.clenzy.scheduler;

import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.service.yield.YieldRuleEngine;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Scheduler quotidien du yield v1 (F8a) — heure creuse (04:40 par défaut,
 * configurable via {@code clenzy.yield.v1.cron}).
 *
 * <p>Itère les orgs dont le kill-switch yield est ON ({@code yield_org_configs.enabled}),
 * et évalue chacune DANS un contexte tenant posé par {@link TenantScopedExecutor}
 * (filtre Hibernate actif — jamais de traitement batch hors isolation tenant).
 * Le moteur re-vérifie le kill-switch et l'existence de règles actives ;
 * un échec sur une org n'interrompt pas les suivantes.</p>
 */
@Component
public class YieldRuleEngineScheduler {

    private static final Logger log = LoggerFactory.getLogger(YieldRuleEngineScheduler.class);

    private final YieldOrgConfigRepository configRepository;
    private final YieldRuleEngine yieldRuleEngine;
    private final TenantScopedExecutor tenantScopedExecutor;

    public YieldRuleEngineScheduler(YieldOrgConfigRepository configRepository,
                                    YieldRuleEngine yieldRuleEngine,
                                    TenantScopedExecutor tenantScopedExecutor) {
        this.configRepository = configRepository;
        this.yieldRuleEngine = yieldRuleEngine;
        this.tenantScopedExecutor = tenantScopedExecutor;
    }

    @Scheduled(cron = "${clenzy.yield.v1.cron:0 40 4 * * *}")
    @SchedulerLock(name = "yield-rule-engine-daily", lockAtMostFor = "PT30M")
    public void runDaily() {
        final List<YieldOrgConfig> enabledConfigs = configRepository.findByEnabledTrue();
        if (enabledConfigs.isEmpty()) {
            return;
        }
        log.info("Yield v1 : évaluation quotidienne — {} org(s) activée(s)", enabledConfigs.size());
        for (YieldOrgConfig config : enabledConfigs) {
            final Long orgId = config.getOrganizationId();
            try {
                tenantScopedExecutor.runAsOrganization(orgId,
                        () -> yieldRuleEngine.evaluateOrganization(orgId));
            } catch (Exception e) {
                // Le moteur journalise déjà les échecs par bien ; ici on isole
                // seulement les orgs entre elles (une org en erreur ne bloque pas les autres).
                log.error("Yield v1 : échec évaluation org={} : {}", orgId, e.getMessage());
            }
        }
    }
}
