package com.clenzy.service.payout;

import com.clenzy.payment.payout.BaitlyStripeTransferRecovery;
import com.clenzy.tenant.TenantScopedExecutor;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

@Service
public class BaitlyCommerceRecoveryWorker {
    private final BaitlyCommerceRecoveryStore store;private final BaitlyStripeTransferRecovery stripe;private final TenantScopedExecutor tenants;
    public BaitlyCommerceRecoveryWorker(BaitlyCommerceRecoveryStore store,BaitlyStripeTransferRecovery stripe,TenantScopedExecutor tenants){this.store=store;this.stripe=stripe;this.tenants=tenants;}
    @Scheduled(initialDelayString="${baitly.commerce.recovery-ms:60000}",fixedDelayString="${baitly.commerce.recovery-ms:60000}")
    @SchedulerLock(name="baitly-commerce-recoveries",lockAtMostFor="PT10M")
    public void resume(){for(var c:store.candidates())try {tenants.runAsOrganization(c.org(),()->process(c));}
        catch(Exception failure){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Récupération commerciale {} à reprendre : {}",c.id(),failure.getClass().getSimpleName());}}
    private void process(BaitlyCommerceRecoveryStore.Candidate c){try {
        var claim=store.claim(c.org(),c.id());if(claim.isEmpty())return;store.confirm(c.org(),c.id(),stripe.recover(claim.get()));
    }catch(Exception failure){String code=failure instanceof IllegalStateException && failure.getMessage()!=null && failure.getMessage().matches("[A-Z_]{1,80}")?failure.getMessage():"COMMERCE_RECOVERY_UNCONFIRMED";store.review(c.org(),c.id(),code);}}
}
