package com.clenzy.scheduler;

import com.clenzy.service.BaitlySubscriptionRecovery;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="baitly.subscription-recovery.enabled",havingValue="true",matchIfMissing=true)
public class BaitlySubscriptionRecoveryScheduler {
    private final BaitlySubscriptionRecovery recovery;
    private final com.clenzy.service.BaitlySubscriptionMoneyEvents funds;
    public BaitlySubscriptionRecoveryScheduler(BaitlySubscriptionRecovery recovery,com.clenzy.service.BaitlySubscriptionMoneyEvents funds){this.recovery=recovery;this.funds=funds;}
    @Scheduled(initialDelayString="${baitly.subscription-recovery.interval-ms:300000}",fixedDelayString="${baitly.subscription-recovery.interval-ms:300000}")
    @SchedulerLock(name="baitly-subscription-recovery",lockAtMostFor="PT15M",lockAtLeastFor="PT5S")
    public void run(){recovery.sweep();funds.recover();}
}
