package com.clenzy.scheduler;

import com.clenzy.service.ai.AiCreditGrantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Recharge mensuelle des crédits IA pour les abonnés PMS <b>prépayés</b>
 * (ANNUAL / BIENNIAL), campagne T-07. Stripe ne déclenche {@code invoice.paid}
 * qu'une fois par période de facturation : sans ce job, un abonné annuel
 * n'aurait qu'un seul mois de crédits sur douze. Les abonnés mensuels sont
 * rechargés par le webhook {@code invoice.paid} (recharge liée au paiement).
 */
@Component
public class AiCreditMonthlyRefreshScheduler {

    private static final Logger log = LoggerFactory.getLogger(AiCreditMonthlyRefreshScheduler.class);

    private final AiCreditGrantService grantService;

    public AiCreditMonthlyRefreshScheduler(AiCreditGrantService grantService) {
        this.grantService = grantService;
    }

    /** Le 1er de chaque mois à 05h00 (Europe/Paris), avant l'activité de la journée. */
    @Scheduled(cron = "0 0 5 1 * *", zone = "Europe/Paris")
    public void refreshPrepaidSubscribers() {
        try {
            int refreshed = grantService.refreshMonthlyForPrepaidSubscribers();
            if (refreshed > 0) {
                log.info("[CREDITS] Recharge mensuelle prépayés : {} org(s) rechargée(s)", refreshed);
            }
        } catch (Exception e) {
            log.warn("[CREDITS] Recharge mensuelle des prépayés en échec (retentera le mois prochain) : {}",
                    e.getMessage(), e);
        }
    }
}
