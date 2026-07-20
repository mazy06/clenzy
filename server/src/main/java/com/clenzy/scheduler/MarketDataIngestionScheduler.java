package com.clenzy.scheduler;

import com.clenzy.service.marketdata.MarketDataIngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

/**
 * Ingestion quotidienne des données de marché — 05:45, après les snapshots
 * calendrier (05:30) : la photo marché du jour suit la photo interne.
 *
 * <p>Corrige l'absence de scheduler de l'ancienne amorce PriceLabs (sync
 * uniquement manuel). Job PLATEFORME : le first-party agrège en SQL k-anonyme
 * sans contexte tenant (aucune ligne individuelle ne sort de la base), les
 * sources externes sont globales par nature.</p>
 */
@Component
public class MarketDataIngestionScheduler {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionScheduler.class);

    private final MarketDataIngestionService ingestionService;
    private final Clock clock;
    private final boolean enabled;

    public MarketDataIngestionScheduler(MarketDataIngestionService ingestionService,
                                        Clock clock,
                                        @Value("${clenzy.rms.market-data.enabled:true}") boolean enabled) {
        this.ingestionService = ingestionService;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${clenzy.rms.market-data.cron:0 45 5 * * *}")
    public void runDaily() {
        if (!enabled) {
            return;
        }
        final LocalDate today = LocalDate.now(clock);
        log.info("Market data : ingestion du {}", today);
        ingestionService.ingestAll(today);
    }
}
