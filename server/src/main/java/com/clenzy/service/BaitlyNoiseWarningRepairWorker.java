package com.clenzy.service;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Baitly: repairs local flags from accepted proof only. Never delegates a message. */
@Component
public class BaitlyNoiseWarningRepairWorker {
    private static final Logger log=LoggerFactory.getLogger(BaitlyNoiseWarningRepairWorker.class);
    private final BaitlyNoiseWarningJournal journal;
    public BaitlyNoiseWarningRepairWorker(BaitlyNoiseWarningJournal journal) { this.journal=journal; }

    @Scheduled(fixedDelayString="${baitly.noise.warning.repair-ms:60000}",
               initialDelayString="${baitly.noise.warning.repair-initial-ms:30000}")
    @SchedulerLock(name="baitly-noise-warning-local-repair",lockAtMostFor="PT10M",lockAtLeastFor="PT5S")
    public void repair() {
        try {
            for(var item:journal.repairQueue()) {
                try { journal.repairAccepted(item.organization(),item.alert()); }
                catch(RuntimeException failure) {
                    log.warn("Baitly bruit : reparation locale non confirmee");
                    try {journal.deferRepair(item);}
                    catch(RuntimeException deferred) {log.warn("Baitly bruit : report de reparation non confirme");}
                }
            }
        } catch(RuntimeException failure) {
            log.warn("Baitly bruit : file de reparation indisponible");
        }
    }
}
