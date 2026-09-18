package com.clenzy.marketplace.service;

import org.slf4j.LoggerFactory;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MarketplaceProvisioningScheduler {
    private final MarketplaceProvisioningJobs jobs;
    private final MarketplaceOnboardingService onboarding;
    public MarketplaceProvisioningScheduler(MarketplaceProvisioningJobs jobs, MarketplaceOnboardingService onboarding) {
        this.jobs = jobs;
        this.onboarding = onboarding;
    }

    @Scheduled(fixedDelayString = "${clenzy.marketplace.provisioning-delay-ms:60000}")
    @SchedulerLock(name = "baitly-marketplace-provisioning", lockAtMostFor = "PT15M")
    public void retryDue() {
        for (Long id : jobs.due()) {
            try { onboarding.onboard(id); }
            catch (RuntimeException failure) {
                LoggerFactory.getLogger(getClass()).warn("Reprise du provisionnement indisponible pour la fiche {}", id);
            }
        }
    }
}
