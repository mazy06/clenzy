package com.clenzy.scheduler;

import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.model.SecurityDeposit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Libération automatique des cautions (booking engine, P0.3) : un hold non capturé est relâché
 * {@link BookingEngineDepositService#RELEASE_DAYS_AFTER_CHECKOUT} jours après le check-out
 * (séjour terminé sans dégâts signalés). La capture pour dégâts reste manuelle côté PMS et,
 * une fois CAPTURED, le dépôt n'est plus candidat à la libération (CAS sur HELD).
 */
@Component
public class BookingCautionScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingCautionScheduler.class);

    private final BookingEngineDepositService depositService;

    public BookingCautionScheduler(BookingEngineDepositService depositService) {
        this.depositService = depositService;
    }

    /** Tous les jours à 04:30 : libère les cautions des séjours terminés depuis le délai configuré. */
    @Scheduled(cron = "0 30 4 * * *")
    public void releaseExpiredHolds() {
        LocalDate cutoff = LocalDate.now().minusDays(BookingEngineDepositService.RELEASE_DAYS_AFTER_CHECKOUT);
        List<SecurityDeposit> holds = depositService.findHoldsToRelease(cutoff);
        if (holds.isEmpty()) {
            return;
        }
        log.info("Libération automatique de {} caution(s) (séjour terminé avant {})", holds.size(), cutoff);
        for (SecurityDeposit deposit : holds) {
            depositService.releaseHold(deposit);
        }
    }
}
