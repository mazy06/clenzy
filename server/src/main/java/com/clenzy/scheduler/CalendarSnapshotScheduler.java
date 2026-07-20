package com.clenzy.scheduler;

import com.clenzy.repository.PropertyElasticityEstimateRepository;
import com.clenzy.repository.PropertyElasticityEstimateRepository.PropertyTenantRow;
import com.clenzy.service.CalendarSnapshotService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Photo quotidienne du calendrier publié (fondations RMS R1) — 05:30, APRÈS le
 * yield v1 (04:40) : la photo capture l'état réellement publié du jour,
 * ajustements yield inclus.
 *
 * <p>Itère toutes les orgs ayant des propriétés ACTIVE, chacune DANS un contexte
 * tenant ({@link TenantScopedExecutor}) ; une org en échec ne bloque pas les
 * suivantes. Idempotent : rejouer le job du jour n'insère rien de nouveau.
 * Un run manqué = un trou d'un jour dans les courbes (aucun rattrapage possible
 * par construction — l'état passé du calendrier n'est pas reconstructible).</p>
 */
@Component
public class CalendarSnapshotScheduler {

    private static final Logger log = LoggerFactory.getLogger(CalendarSnapshotScheduler.class);

    private final PropertyElasticityEstimateRepository propertyTenantRepository;
    private final CalendarSnapshotService snapshotService;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final Clock clock;
    private final boolean enabled;

    public CalendarSnapshotScheduler(PropertyElasticityEstimateRepository propertyTenantRepository,
                                     CalendarSnapshotService snapshotService,
                                     TenantScopedExecutor tenantScopedExecutor,
                                     Clock clock,
                                     @Value("${clenzy.rms.snapshot.enabled:true}") boolean enabled) {
        this.propertyTenantRepository = propertyTenantRepository;
        this.snapshotService = snapshotService;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${clenzy.rms.snapshot.cron:0 30 5 * * *}")
    public void runDaily() {
        if (!enabled) {
            return;
        }
        final LocalDate snapshotDate = LocalDate.now(clock);
        // TreeSet : ordre stable des orgs (logs et reprises lisibles).
        final List<Long> orgIds = propertyTenantRepository.listActivePropertyIds().stream()
                .map(PropertyTenantRow::organizationId)
                .collect(Collectors.toCollection(TreeSet::new))
                .stream().toList();
        if (orgIds.isEmpty()) {
            return;
        }
        log.info("Snapshot calendrier : run du {} — {} org(s)", snapshotDate, orgIds.size());
        for (Long orgId : orgIds) {
            try {
                tenantScopedExecutor.runAsOrganization(orgId,
                        () -> snapshotService.snapshotOrganization(orgId, snapshotDate));
            } catch (Exception e) {
                log.error("Snapshot calendrier : échec org={} : {}", orgId, e.getMessage());
            }
        }
    }
}
