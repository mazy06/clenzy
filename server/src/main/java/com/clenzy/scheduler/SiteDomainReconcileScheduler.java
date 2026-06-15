package com.clenzy.scheduler;

import com.clenzy.booking.service.SiteAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Réconciliation des domaines custom (P1.1 d) : interroge périodiquement Cloudflare for SaaS pour
 * les domaines PENDING provisionnés et bascule leur statut (ACTIVE/FAILED). No-op si le bridge
 * Cloudflare n'est pas configuré (token absent → {@code reconcileCustomDomains} sort tôt).
 */
@Component
public class SiteDomainReconcileScheduler {

    private static final Logger log = LoggerFactory.getLogger(SiteDomainReconcileScheduler.class);

    private final SiteAdminService siteAdminService;

    public SiteDomainReconcileScheduler(SiteAdminService siteAdminService) {
        this.siteAdminService = siteAdminService;
    }

    /** Toutes les 5 minutes. */
    @Scheduled(fixedDelayString = "300000", initialDelayString = "120000")
    public void reconcile() {
        try {
            siteAdminService.reconcileCustomDomains();
        } catch (Exception e) {
            log.error("Réconciliation des domaines custom échouée : {}", e.getMessage());
        }
    }
}
