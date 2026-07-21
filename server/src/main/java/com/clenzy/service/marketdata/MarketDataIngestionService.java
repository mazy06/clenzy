package com.clenzy.service.marketdata;

import com.clenzy.model.MarketDataSnapshot;
import com.clenzy.repository.MarketDataSnapshotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Ingestion des benchmarks de marché : interroge chaque source configurée du
 * registry et persiste la photo du jour dans {@code market_data_snapshots}.
 *
 * <p>Idempotent par (source, snapshot_date) : rejouer le jour remplace la photo
 * du jour de cette source (delete + insert dans la même transaction — via
 * {@link TransactionTemplate}, jamais d'auto-invocation {@code @Transactional}).
 * Fenêtre : {@value #LOOKBACK_MONTHS} mois en arrière, mois courant inclus.</p>
 */
@Service
public class MarketDataIngestionService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionService.class);

    static final int LOOKBACK_MONTHS = 12;

    private final MarketDataSourceRegistry registry;
    private final MarketDataSnapshotRepository snapshotRepository;
    private final TransactionTemplate perSourceTx;

    public MarketDataIngestionService(MarketDataSourceRegistry registry,
                                      MarketDataSnapshotRepository snapshotRepository,
                                      PlatformTransactionManager transactionManager) {
        this.registry = registry;
        this.snapshotRepository = snapshotRepository;
        this.perSourceTx = new TransactionTemplate(transactionManager);
    }

    /** Ingère toutes les sources configurées. Une source en échec ne bloque pas les autres. */
    public void ingestAll(LocalDate snapshotDate) {
        for (MarketDataProvider provider : registry.configured()) {
            try {
                // Fetch HORS transaction (peut être un appel HTTP externe pour les
                // sources payantes — jamais d'appel externe dans une tx DB), puis
                // remplacement atomique de la photo du jour.
                final YearMonth current = YearMonth.from(snapshotDate);
                final List<MarketBenchmark> benchmarks = provider.fetchBenchmarks(
                        current.minusMonths(LOOKBACK_MONTHS - 1L), current);
                perSourceTx.executeWithoutResult(status ->
                        replaceSnapshot(provider.type().name(), snapshotDate, benchmarks));
            } catch (RuntimeException e) {
                log.error("Market data : échec ingestion source={} : {}",
                        provider.type(), e.getMessage());
            }
        }
    }

    private void replaceSnapshot(String source, LocalDate snapshotDate,
                                 List<MarketBenchmark> benchmarks) {
        final int replaced = snapshotRepository.deleteBySourceAndSnapshotDate(source, snapshotDate);
        final List<MarketDataSnapshot> rows = benchmarks.stream()
                .map(b -> new MarketDataSnapshot(
                        null, // benchmark plateforme — jamais rattaché à un tenant
                        b.area(), b.countryCode(), source,
                        snapshotDate, b.stayMonth().toString(),
                        b.adr(), b.occupancyPct(), b.revPar(), b.currency(),
                        b.sampleSize(), b.confidence()))
                .toList();
        snapshotRepository.saveAll(rows);
        log.info("Market data : source={} — {} cellule(s) ingérée(s) ({} remplacée(s))",
                source, rows.size(), replaced);
    }
}
