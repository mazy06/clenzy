package com.clenzy.service.marketdata;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/**
 * Benchmark « réseau Baitly » (étage 1 de la roadmap market data, budget zéro) :
 * agrégats anonymisés des réservations RÉELLES du réseau — prix VENDUS, pas
 * affichés, qualitativement supérieurs au scraping.
 *
 * <p><b>Vie privée par construction</b> : le k-anonymat (≥ {@value #K_ANONYMITY}
 * biens distincts par cellule ville × devise × mois) est appliqué <b>en SQL</b>
 * ({@code HAVING COUNT(DISTINCT property_id) >= k}) — aucune ligne individuelle,
 * aucun identifiant de bien ou de tenant ne quitte la base. Le résultat est un
 * benchmark PLATEFORME (organization_id null en persistance).</p>
 *
 * <p>Approximations assumées (benchmark mensuel, pas de la compta) : réservation
 * attribuée au mois du check-in ; occupation = nuits vendues / (biens distincts ×
 * jours du mois). La cellule sépare les devises pour ne jamais mélanger MAD/EUR.</p>
 */
@Service
public class FirstPartyMarketDataProvider implements MarketDataProvider {

    /** Seuil de k-anonymat — non négociable (RGPD/CNDP, roadmap §3). */
    static final int K_ANONYMITY = 5;
    /** sample_size à partir duquel la confiance de densité atteint 1.0. */
    private static final double FULL_CONFIDENCE_SAMPLE = 20.0;

    private static final String AGGREGATE_SQL = """
            SELECT p.city AS area,
                   p.country_code AS country_code,
                   COALESCE(r.currency, 'EUR') AS currency,
                   to_char(r.check_in, 'YYYY-MM') AS stay_month,
                   SUM(r.total_price) AS revenue,
                   SUM(GREATEST(1, r.check_out - r.check_in)) AS nights,
                   COUNT(DISTINCT r.property_id) AS sample_size
            FROM reservations r
            JOIN properties p ON p.id = r.property_id
            WHERE LOWER(r.status) <> 'cancelled'
              AND p.city IS NOT NULL AND p.city <> ''
              AND r.check_in >= ?::date AND r.check_in < ?::date
            GROUP BY p.city, p.country_code, COALESCE(r.currency, 'EUR'), to_char(r.check_in, 'YYYY-MM')
            HAVING COUNT(DISTINCT r.property_id) >= ?
            """;

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;

    public FirstPartyMarketDataProvider(JdbcTemplate jdbcTemplate,
                                        @Value("${clenzy.rms.market-data.first-party.enabled:true}") boolean enabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
    }

    @Override
    public MarketDataProviderType type() {
        return MarketDataProviderType.FIRST_PARTY;
    }

    @Override
    public boolean isConfigured() {
        return enabled;
    }

    @Override
    public List<MarketBenchmark> fetchBenchmarks(YearMonth fromInclusive, YearMonth toInclusive) {
        final String from = fromInclusive.atDay(1).toString();
        final String toExclusive = toInclusive.plusMonths(1).atDay(1).toString();
        final List<MarketBenchmark> benchmarks = new ArrayList<>();
        jdbcTemplate.query(AGGREGATE_SQL, rs -> {
            final YearMonth stayMonth = YearMonth.parse(rs.getString("stay_month"));
            final BigDecimal revenue = rs.getBigDecimal("revenue");
            final long nights = rs.getLong("nights");
            final int sampleSize = rs.getInt("sample_size");
            final long availableNights = (long) sampleSize * stayMonth.lengthOfMonth();
            benchmarks.add(new MarketBenchmark(
                    rs.getString("area"),
                    rs.getString("country_code"),
                    stayMonth,
                    nights > 0 ? revenue.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP) : null,
                    availableNights > 0
                            ? BigDecimal.valueOf(Math.min(100.0,
                                    nights * 100.0 / availableNights)).setScale(2, RoundingMode.HALF_UP)
                            : null,
                    availableNights > 0
                            ? revenue.divide(BigDecimal.valueOf(availableNights), 2, RoundingMode.HALF_UP)
                            : null,
                    rs.getString("currency"),
                    sampleSize,
                    confidenceFor(sampleSize)));
        }, from, toExclusive, K_ANONYMITY);
        return benchmarks;
    }

    /** Confiance = densité de l'échantillon (1.0 dès 20 biens), plafonnée à 0.9 : le
     *  first-party reste un signal « réseau », jamais présenté comme LE marché. */
    static BigDecimal confidenceFor(int sampleSize) {
        final double density = Math.min(1.0, sampleSize / FULL_CONFIDENCE_SAMPLE);
        return BigDecimal.valueOf(Math.min(0.9, density * 0.9)).setScale(2, RoundingMode.HALF_UP);
    }
}
