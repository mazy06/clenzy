package com.clenzy.scheduler;

import com.clenzy.booking.service.GuestCreditService;
import com.clenzy.booking.service.GuestReferralService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Crédit fidélité (2.8 phase 2b) + parrainage (2.11) : chaque jour, crédite les séjours directs
 * terminés (check-out passé) — % fidélité pour le voyageur, et crédit de parrainage aux deux côtés
 * quand un filleul termine son séjour. Idempotent (un séjour / un lien crédité une seule fois).
 * Délégation aux services (scheduler mince).
 */
@Component
public class GuestLoyaltyScheduler {

    private static final Logger log = LoggerFactory.getLogger(GuestLoyaltyScheduler.class);

    private final GuestCreditService creditService;
    private final GuestReferralService referralService;

    public GuestLoyaltyScheduler(GuestCreditService creditService, GuestReferralService referralService) {
        this.creditService = creditService;
        this.referralService = referralService;
    }

    /** Tous les jours à 04:45 : crédite les séjours dont le check-out est passé (cutoff = aujourd'hui). */
    @Scheduled(cron = "0 45 4 * * *")
    @SchedulerLock(name = "guest-loyalty-credit", lockAtMostFor = "PT10M")
    public void creditCompletedStays() {
        LocalDate cutoff = LocalDate.now();
        int credited = creditService.creditCompletedStays(cutoff);
        if (credited > 0) {
            log.info("Crédit fidélité : {} séjour(s) crédité(s)", credited);
        }
        int referrals = referralService.grantCompletedStays(cutoff);
        if (referrals > 0) {
            log.info("Parrainage : {} parrainage(s) crédité(s)", referrals);
        }
    }
}
