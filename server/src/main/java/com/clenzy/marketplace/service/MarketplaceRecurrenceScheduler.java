package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceRecurrenceRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.LocalDate;

@Component
public class MarketplaceRecurrenceScheduler {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MarketplaceRecurrenceScheduler.class);
    private final MarketplaceRecurrenceRepository plans;
    private final MarketplaceRecurrenceService service;
    private final TenantScopedExecutor tenants;
    private final Clock clock;
    public MarketplaceRecurrenceScheduler(MarketplaceRecurrenceRepository plans, MarketplaceRecurrenceService service,
            TenantScopedExecutor tenants, Clock clock) {
        this.plans = plans; this.service = service; this.tenants = tenants; this.clock = clock;
    }
    @Scheduled(fixedDelayString = "${baitly.marketplace.recurrence.delay-ms:3600000}")
    @SchedulerLock(name = "baitly-marketplace-recurrence", lockAtMostFor = "PT30M")
    public void generateDue() {
        // Borne large pour les logements à UTC+14 ; le service tranche dans leur fuseau.
        for (var due : plans.findDue(LocalDate.now(clock.withZone(java.time.ZoneOffset.UTC)).plusDays(1))) {
            try {
                tenants.runAsOrganization(due.getOrganizationId(), () -> service.generate(due.getQuoteRequestId()));
            } catch (RuntimeException failure) {
                log.warn("Échéance du devis {} à reprendre", due.getQuoteRequestId(), failure);
            }
        }
    }
}
