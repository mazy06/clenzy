package com.clenzy.scheduler;

import com.clenzy.service.ai.AiCreditGrantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Expiration quotidienne des poches de credits IA echues (campagne T-07,
 * D-102 : pas de rollover — le non-consomme est journalise en ligne EXPIRY du
 * ledger, auditable, puis la poche est soldee).
 */
@Component
public class AiCreditExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(AiCreditExpiryScheduler.class);

    private final AiCreditGrantService grantService;

    public AiCreditExpiryScheduler(AiCreditGrantService grantService) {
        this.grantService = grantService;
    }

    /** Tous les jours a 04h10 (creux, apres les jobs de nuit existants). */
    @Scheduled(cron = "0 10 4 * * *")
    public void expireOverdueGrants() {
        try {
            int expired = grantService.expireOverdueGrants();
            if (expired > 0) {
                log.info("[CREDITS] {} poche(s) expirée(s) journalisée(s) en EXPIRY", expired);
            }
        } catch (Exception e) {
            log.warn("[CREDITS] Job d'expiration en echec (retentera demain) : {}", e.getMessage(), e);
        }
    }
}
