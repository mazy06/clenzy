package com.clenzy.service.marketdata;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Étage 2 de la roadmap market data (budget zéro) : benchmarks issus de datasets
 * <b>sous licence ouverte</b> (Inside Airbnb, open data tourisme), importés en CSV.
 *
 * <p>Le provider lit les fichiers {@code *.csv} d'un répertoire configurable
 * ({@code clenzy.rms.market-data.open-data.dir}) — l'admin télécharge le dataset,
 * le convertit au format documenté ci-dessous, le dépose ; l'ingestion quotidienne
 * fait le reste. Aucun scraping : uniquement des données publiées pour réutilisation
 * (décision roadmap 2026-07-20).</p>
 *
 * <p><b>Format CSV attendu</b> (en-tête obligatoire, séparateur virgule) :
 * {@code area,country_code,stay_month,adr,occupancy_pct,revpar,currency,sample_size}
 * — ex. {@code Marrakech,MA,2026-06,620,58.5,362,MAD,4100}. Les lignes invalides
 * sont ignorées (log warn) : un dataset partiellement propre reste utilisable.</p>
 */
@Service
public class OpenDataMarketDataProvider implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenDataMarketDataProvider.class);

    /** Fiabilité de base d'un dataset ouvert : fraîcheur trimestrielle, prix affichés. */
    private static final BigDecimal BASE_CONFIDENCE = new BigDecimal("0.60");
    private static final int EXPECTED_COLUMNS = 8;

    private final Path dataDir;

    public OpenDataMarketDataProvider(
            @Value("${clenzy.rms.market-data.open-data.dir:}") String dataDir) {
        this.dataDir = dataDir == null || dataDir.isBlank() ? null : Path.of(dataDir);
    }

    @Override
    public MarketDataProviderType type() {
        return MarketDataProviderType.OPEN_DATA;
    }

    @Override
    public boolean isConfigured() {
        return dataDir != null && Files.isDirectory(dataDir);
    }

    @Override
    public List<MarketBenchmark> fetchBenchmarks(YearMonth fromInclusive, YearMonth toInclusive) {
        final List<MarketBenchmark> benchmarks = new ArrayList<>();
        try (Stream<Path> files = Files.list(dataDir)) {
            files.filter(f -> f.getFileName().toString().toLowerCase().endsWith(".csv"))
                    .sorted()
                    .forEach(f -> parseFile(f, fromInclusive, toInclusive, benchmarks));
        } catch (IOException e) {
            log.warn("Open data : lecture du répertoire {} impossible : {}", dataDir, e.getMessage());
        }
        return benchmarks;
    }

    private void parseFile(Path file, YearMonth from, YearMonth to, List<MarketBenchmark> out) {
        try (Stream<String> lines = Files.lines(file)) {
            lines.skip(1) // en-tête
                    .map(String::trim)
                    .filter(l -> !l.isEmpty())
                    .forEach(line -> {
                        final MarketBenchmark benchmark = parseLine(line);
                        if (benchmark != null
                                && !benchmark.stayMonth().isBefore(from)
                                && !benchmark.stayMonth().isAfter(to)) {
                            out.add(benchmark);
                        }
                    });
        } catch (IOException | RuntimeException e) {
            log.warn("Open data : fichier {} illisible : {}", file.getFileName(), e.getMessage());
        }
    }

    /** Une ligne invalide renvoie null (ignorée) — dataset partiellement propre accepté. */
    private MarketBenchmark parseLine(String line) {
        final String[] cols = line.split(",", -1);
        if (cols.length < EXPECTED_COLUMNS) {
            log.warn("Open data : ligne ignorée ({} colonnes au lieu de {})", cols.length, EXPECTED_COLUMNS);
            return null;
        }
        try {
            final int sampleSize = Integer.parseInt(cols[7].trim());
            return new MarketBenchmark(
                    cols[0].trim(),
                    blankToNull(cols[1]),
                    YearMonth.parse(cols[2].trim()),
                    parseDecimal(cols[3]),
                    parseDecimal(cols[4]),
                    parseDecimal(cols[5]),
                    blankToNull(cols[6]),
                    sampleSize,
                    confidenceFor(sampleSize));
        } catch (RuntimeException e) {
            log.warn("Open data : ligne ignorée ({})", e.getMessage());
            return null;
        }
    }

    /** Confiance = base dataset ouvert × densité (pleine dès 100 biens — données scrapées larges). */
    static BigDecimal confidenceFor(int sampleSize) {
        final double density = Math.min(1.0, sampleSize / 100.0);
        return BASE_CONFIDENCE.multiply(BigDecimal.valueOf(density)).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal parseDecimal(String raw) {
        final String value = raw.trim();
        return value.isEmpty() ? null : new BigDecimal(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String raw) {
        final String value = raw.trim();
        return value.isEmpty() ? null : value;
    }
}
