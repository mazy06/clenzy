package com.clenzy.scheduler;

import com.clenzy.service.ai.CreditReconciliationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.YearMonth;
import java.time.ZoneOffset;

/**
 * Reconciliation du systeme de credits (campagne X10) : solde chaud quotidien
 * (Redis ↔ poches, auto-correction) + rapport mensuel (marge par provider a
 * rapprocher des factures, revenu par source, cross-check interne).
 */
@Component
public class CreditReconciliationScheduler {

    private static final Logger log = LoggerFactory.getLogger(CreditReconciliationScheduler.class);

    private final CreditReconciliationService reconciliationService;

    public CreditReconciliationScheduler(CreditReconciliationService reconciliationService) {
        this.reconciliationService = reconciliationService;
    }

    /** Tous les jours a 05h45 (apres l'expiration des poches 04h10). */
    @Scheduled(cron = "0 45 5 * * *")
    public void reconcileHotBalances() {
        try {
            int drifts = reconciliationService.reconcileHotBalances();
            if (drifts > 0) {
                log.warn("[RECONCILIATION] {} derive(s) de solde chaud corrigee(s)", drifts);
            }
        } catch (Exception e) {
            log.warn("[RECONCILIATION] Verification des soldes en echec (retentera demain) : {}",
                    e.getMessage(), e);
        }
    }

    /** Le 2 de chaque mois a 06h00 : rapport du mois PRECEDENT (loggue — lecture via l'endpoint admin). */
    @Scheduled(cron = "0 0 6 2 * *")
    public void monthlyReport() {
        try {
            YearMonth previous = YearMonth.now(ZoneOffset.UTC).minusMonths(1);
            var report = reconciliationService.monthlyReport(previous);
            log.info("[RECONCILIATION] Rapport mensuel {} : {}", previous, report);
        } catch (Exception e) {
            log.warn("[RECONCILIATION] Rapport mensuel en echec : {}", e.getMessage(), e);
        }
    }
}
