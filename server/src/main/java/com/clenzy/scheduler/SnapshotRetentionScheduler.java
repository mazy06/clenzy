package com.clenzy.scheduler;

import com.clenzy.repository.CalendarDaySnapshotJdbcRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/**
 * Compaction hebdomadaire de {@code calendar_day_snapshots} : au-delà de la
 * rétention pleine granularité ({@code clenzy.rms.snapshot.retention-days},
 * défaut 400 j — il faut &gt; 1 an pour le same-time-last-year), on ne garde
 * qu'une photo par semaine (celle du lundi). Purge par tranche de snapshot_date
 * (jamais de DELETE géant), bornée par run — le reliquat part au run suivant.
 */
@Component
public class SnapshotRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(SnapshotRetentionScheduler.class);

    /** Tranches (snapshot_date) purgées au maximum par run. */
    private static final int MAX_DATES_PER_RUN = 30;

    private final CalendarDaySnapshotJdbcRepository snapshotRepository;
    private final Clock clock;
    private final int retentionDays;

    public SnapshotRetentionScheduler(CalendarDaySnapshotJdbcRepository snapshotRepository,
                                      Clock clock,
                                      @Value("${clenzy.rms.snapshot.retention-days:400}") int retentionDays) {
        this.snapshotRepository = snapshotRepository;
        this.clock = clock;
        this.retentionDays = retentionDays;
    }

    /** Dimanche 05:50 : après la photo du jour, heure creuse. */
    @Scheduled(cron = "${clenzy.rms.snapshot.retention-cron:0 50 5 * * SUN}")
    public void runWeekly() {
        final LocalDate cutoff = LocalDate.now(clock).minusDays(retentionDays);
        final List<LocalDate> dates =
                snapshotRepository.findCompactableSnapshotDates(cutoff, MAX_DATES_PER_RUN);
        if (dates.isEmpty()) {
            return;
        }
        long deleted = 0;
        for (LocalDate date : dates) {
            deleted += snapshotRepository.deleteSnapshotDate(date);
        }
        log.info("Compaction snapshots : {} tranche(s) purgée(s) avant {} ({} lignes)",
                dates.size(), cutoff, deleted);
    }
}
