package com.clenzy.scheduler;

import com.clenzy.booking.service.GuestCreditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Crédit fidélité (2.8 phase 2b) : chaque jour, crédite les séjours directs terminés (check-out
 * passé) du % configuré par l'org. Idempotent (un séjour crédité une seule fois). Délégation au
 * service (controller/scheduler mince).
 */
@Component
public class GuestLoyaltyScheduler {

    private static final Logger log = LoggerFactory.getLogger(GuestLoyaltyScheduler.class);

    private final GuestCreditService creditService;

    public GuestLoyaltyScheduler(GuestCreditService creditService) {
        this.creditService = creditService;
    }

    /** Tous les jours à 04:45 : crédite les séjours dont le check-out est passé (cutoff = aujourd'hui). */
    @Scheduled(cron = "0 45 4 * * *")
    public void creditCompletedStays() {
        int credited = creditService.creditCompletedStays(LocalDate.now());
        if (credited > 0) {
            log.info("Crédit fidélité : {} séjour(s) crédité(s)", credited);
        }
    }
}
