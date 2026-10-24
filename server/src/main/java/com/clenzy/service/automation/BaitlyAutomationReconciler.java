package com.clenzy.service.automation;

import io.micrometer.core.instrument.MeterRegistry;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.*;

/** Baitly receipt reconciliation only. No business executor or provider is reachable from this worker. */
@Component
public class BaitlyAutomationReconciler {
    private static final Logger log=LoggerFactory.getLogger(BaitlyAutomationReconciler.class);
    private final BaitlyAutomationJournal journal;
    private final Clock clock;
    private final MeterRegistry registry;
    public BaitlyAutomationReconciler(BaitlyAutomationJournal journal, Clock clock, MeterRegistry registry) {
        this.journal=journal;this.clock=clock;this.registry=registry;
    }
    @Scheduled(fixedDelayString="${baitly.automation.reconciliation-ms:60000}",
               initialDelayString="${baitly.automation.reconciliation-initial-ms:30000}")
    @SchedulerLock(name="baitly-automation-proof-reconciliation",lockAtMostFor="PT1M")
    public void reconcile() {
        LocalDateTime now=LocalDateTime.ofInstant(clock.instant(),ZoneId.systemDefault());
        try {
            for(var ticket:journal.recoveryCandidates(now)) {
                try {
                    if(journal.applyProof(ticket,now,true)) registry.counter("baitly.automation.reconciled").increment();
                } catch(RuntimeException failure) {failed();}
            }
        } catch(RuntimeException failure) {failed();}
    }
    private void failed() {
        registry.counter("baitly.automation.reconciliation.failures").increment();
        log.warn("Baitly automation reconciliation unavailable; uncertain attempts remain protected");
    }
}
