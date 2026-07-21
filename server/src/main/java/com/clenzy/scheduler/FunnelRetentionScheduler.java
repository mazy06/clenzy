package com.clenzy.scheduler;

import com.clenzy.repository.BookingFunnelEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

/**
 * Purge RGPD des événements de funnel booking engine : rétention
 * {@code clenzy.rms.funnel.retention-days} (défaut 396 j ≈ 13 mois — standard
 * analytics, couvre le same-time-last-year). Suppression par tranches bornées ;
 * le reliquat part au run suivant.
 */
@Component
public class FunnelRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(FunnelRetentionScheduler.class);

    private static final int MAX_ROWS_PER_RUN = 50_000;

    private final BookingFunnelEventRepository repository;
    private final Clock clock;
    private final int retentionDays;

    public FunnelRetentionScheduler(BookingFunnelEventRepository repository,
                                    Clock clock,
                                    @Value("${clenzy.rms.funnel.retention-days:396}") int retentionDays) {
        this.repository = repository;
        this.clock = clock;
        this.retentionDays = retentionDays;
    }

    /** Quotidien 04:10, heure creuse (avant yield 04:40 et snapshots 05:30). */
    @Scheduled(cron = "${clenzy.rms.funnel.retention-cron:0 10 4 * * *}")
    @Transactional
    public void runDaily() {
        final LocalDateTime cutoff = LocalDateTime.now(clock).minusDays(retentionDays);
        final int deleted = repository.deleteOlderThan(cutoff, MAX_ROWS_PER_RUN);
        if (deleted > 0) {
            log.info("Purge funnel booking : {} événement(s) antérieur(s) au {} supprimé(s)",
                    deleted, cutoff.toLocalDate());
        }
    }
}
