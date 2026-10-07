package com.clenzy.service.payout;

import com.clenzy.model.PayoutRecoveryJob;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.StripeBankPayoutHandler;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Clock;
import java.util.HashSet;

/** Relecture bancaire bornée. Ne crée ni transfert ni versement bancaire. */
@Service
public class PayoutRecoveryService {
    private static final Logger log = LoggerFactory.getLogger(PayoutRecoveryService.class);
    private final PayoutRecoveryStore store;
    private final StripeGateway stripe;
    private final StripeBankPayoutHandler observer;
    private final TenantContext tenant;
    private final Clock clock;
    public PayoutRecoveryService(PayoutRecoveryStore store, StripeGateway stripe, StripeBankPayoutHandler observer,
            TenantContext tenant, Clock clock) {
        this.store=store; this.stripe=stripe; this.observer=observer; this.tenant=tenant; this.clock=clock;
    }
    public void sweep() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Rattrapage hors transaction requis.");
        boolean previous = tenant.isSystemOrg();
        try {
            tenant.setSystemOrg(true);
            store.flagStalled(clock.instant());
            if (!stripe.isConfigured()) return;
            store.seed();
            long deadline = System.nanoTime() + java.time.Duration.ofMinutes(4).toNanos();
            for (int i=0; i<10 && System.nanoTime()<deadline; i++) {
                var job = store.claim(clock.instant());
                if (job.isEmpty()) break;
                recover(job.get());
            }
        } finally { tenant.setSystemOrg(previous); }
    }
    private void recover(PayoutRecoveryJob job) {
        try {
            var response = stripe.listConnectedPayouts(job.getAccountId(),job.getEarliestAt().getEpochSecond(),
                    job.getWindowEnd().getEpochSecond(),job.getAfterPayoutId());
            if (response == null || response.getData() == null || response.getHasMore() == null
                    || response.getData().size()>25 || (response.getHasMore() && response.getData().isEmpty())) {
                throw new IllegalStateException("Page bancaire incomplète.");
            }
            var seen = new HashSet<String>();
            if (job.getAfterPayoutId()!=null) seen.add(job.getAfterPayoutId());
            String after = job.getAfterPayoutId();
            for (var payout : response.getData()) {
                if (payout.getId()==null || !seen.add(payout.getId()) || payout.getCreated()==null
                        || payout.getCreated()<job.getEarliestAt().getEpochSecond() || payout.getCreated()>job.getWindowEnd().getEpochSecond()
                        || !Boolean.valueOf(job.isLivemode()).equals(payout.getLivemode())) {
                    throw new IllegalStateException("Pagination bancaire incohérente.");
                }
                if (!store.renew(job,clock.instant())) throw new IllegalStateException("Bail de rattrapage expiré.");
                observer.recover(job.getAccountId(),job.isLivemode(),payout.getId(),clock.instant());
                after=payout.getId();
            }
            store.checkpoint(job,after,!response.getHasMore(),clock.instant());
        } catch (Exception failure) {
            store.failed(job,clock.instant());
            log.warn("Baitly : rattrapage bancaire différé, job={}, cause={}",job.getId(),failure.getClass().getSimpleName());
        }
    }
}
