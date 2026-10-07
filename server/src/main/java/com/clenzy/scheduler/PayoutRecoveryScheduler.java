package com.clenzy.scheduler;

import com.clenzy.service.payout.PayoutRecoveryService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Activation explicite après validation du compte Stripe de l'environnement. */
@Component
@ConditionalOnProperty(name="baitly.payout-monitoring.enabled",havingValue="true")
public class PayoutRecoveryScheduler {
    private final PayoutRecoveryService service;
    public PayoutRecoveryScheduler(PayoutRecoveryService service) { this.service=service; }
    @Scheduled(fixedDelayString="${baitly.payout-monitoring.interval-ms:300000}")
    @SchedulerLock(name="baitly-payout-recovery",lockAtMostFor="PT15M",lockAtLeastFor="PT5S")
    public void run() { service.sweep(); }
}
