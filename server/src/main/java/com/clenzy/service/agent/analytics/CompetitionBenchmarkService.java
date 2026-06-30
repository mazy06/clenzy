package com.clenzy.service.agent.analytics;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.Property;
import com.clenzy.repository.ExternalPricingConfigRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.ExternalPricingService;
import com.clenzy.service.ExternalPricingSourceRegistry;
import com.clenzy.service.PriceEngine;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Benchmark concurrence / positionnement marché (P2-11) — agent {@code rep} (specialist insights).
 *
 * <p>Interroge la/les <b>source(s) de données de marché activée(s)</b>
 * ({@link ExternalPricingSourceRegistry} : PriceLabs, Beyond, Wheelhouse…) pour un
 * logement et compare au <b>prix courant</b> ({@link PriceEngine}). Plusieurs sources
 * sont présentées <b>en concurrence</b> (côte à côte). Read-only : positionne, ne
 * modifie aucun prix. Org-scopée.</p>
 *
 * <p>Non transactionnel : les appels aux providers sont des appels HTTP externes
 * (jamais dans une transaction DB). Une source en échec est marquée indisponible
 * sans casser le benchmark des autres.</p>
 */
@Service
public class CompetitionBenchmarkService {

    private static final Logger log = LoggerFactory.getLogger(CompetitionBenchmarkService.class);
    private static final int DEFAULT_WINDOW_DAYS = 30;
    private static final int MAX_WINDOW_DAYS = 180;
    private static final BigDecimal UNDER = new BigDecimal("0.95");
    private static final BigDecimal OVER = new BigDecimal("1.05");

    private final ExternalPricingConfigRepository configRepository;
    private final ExternalPricingSourceRegistry sourceRegistry;
    private final PriceEngine priceEngine;
    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;
    private final Clock clock;

    public CompetitionBenchmarkService(ExternalPricingConfigRepository configRepository,
                                       ExternalPricingSourceRegistry sourceRegistry,
                                       PriceEngine priceEngine,
                                       PropertyRepository propertyRepository,
                                       TenantContext tenantContext,
                                       Clock clock) {
        this.configRepository = configRepository;
        this.sourceRegistry = sourceRegistry;
        this.priceEngine = priceEngine;
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record SourceBenchmark(
            String source, BigDecimal yourAvgPrice, BigDecimal marketAvgPrice,
            Double deltaPct, double avgConfidence, String positioning, int days) {}

    public record BenchmarkResult(
            Long propertyId, int windowDays, int sources,
            List<SourceBenchmark> bySource, String headline) {}

    public BenchmarkResult benchmark(Long propertyId, int windowDays) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        int window = Math.max(7, Math.min(windowDays, MAX_WINDOW_DAYS));
        LocalDate end = today.plusDays(window);

        // Ownership (règle audit #3) AVANT resolvePriceRange : propertyId vient de l'argument du tool
        // (LLM) et le fallback nightlyPrice de PriceEngine n'est pas tenant-safe → sinon fuite de prix cross-org.
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || !orgId.equals(property.getOrganizationId())) {
            return new BenchmarkResult(propertyId, window, 0, List.of(), "Logement introuvable.");
        }

        List<ExternalPricingConfig> enabled = configRepository.findByOrganizationId(orgId).stream()
                .filter(c -> Boolean.TRUE.equals(c.getEnabled()))
                .toList();
        if (enabled.isEmpty()) {
            return new BenchmarkResult(propertyId, window, 0, List.of(),
                    "Aucune source de données de marché activée. Configurez-en une dans les intégrations pricing (PriceLabs, Beyond…).");
        }

        BigDecimal yourAvg = average(priceEngine.resolvePriceRange(propertyId, today, end, orgId).values());

        List<SourceBenchmark> bySource = new ArrayList<>();
        for (ExternalPricingConfig config : enabled) {
            String name = config.getProvider() != null ? config.getProvider().name() : "?";
            try {
                ExternalPricingService source = sourceRegistry.resolve(config.getProvider());
                List<ExternalPriceRecommendation> recs =
                        source.fetchRecommendations(config, propertyId, today, end);
                bySource.add(toBenchmark(name, yourAvg, recs));
            } catch (Exception e) {
                log.warn("Benchmark source {} indisponible : {}", name, e.getMessage());
                bySource.add(new SourceBenchmark(name, yourAvg, null, null, 0d,
                        "UNAVAILABLE", 0));
            }
        }

        return new BenchmarkResult(propertyId, window, bySource.size(), bySource, headline(bySource));
    }

    private SourceBenchmark toBenchmark(String name, BigDecimal yourAvg,
                                        List<ExternalPriceRecommendation> recs) {
        List<BigDecimal> prices = recs.stream()
                .map(ExternalPriceRecommendation::recommendedPrice)
                .filter(p -> p != null)
                .toList();
        BigDecimal marketAvg = average(prices);
        double avgConf = recs.stream()
                .map(ExternalPriceRecommendation::confidence)
                .filter(c -> c != null)
                .mapToDouble(Double::doubleValue)
                .average().orElse(0d);

        Double deltaPct = null;
        String positioning = "N/A";
        if (yourAvg != null && marketAvg != null && marketAvg.signum() > 0) {
            deltaPct = yourAvg.subtract(marketAvg)
                    .divide(marketAvg, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(1, RoundingMode.HALF_UP)
                    .doubleValue();
            if (yourAvg.compareTo(marketAvg.multiply(UNDER)) < 0) {
                positioning = "UNDERPRICED"; // sous le marché → marge de hausse
            } else if (yourAvg.compareTo(marketAvg.multiply(OVER)) > 0) {
                positioning = "OVERPRICED"; // au-dessus → risque de sous-occupation
            } else {
                positioning = "ALIGNED";
            }
        }
        return new SourceBenchmark(name, yourAvg, marketAvg, deltaPct,
                Math.round(avgConf * 100.0) / 100.0, positioning, recs.size());
    }

    private static BigDecimal average(java.util.Collection<BigDecimal> values) {
        List<BigDecimal> list = values.stream().filter(v -> v != null).toList();
        if (list.isEmpty()) {
            return null;
        }
        BigDecimal sum = list.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(list.size()), 2, RoundingMode.HALF_UP);
    }

    private static String headline(List<SourceBenchmark> bySource) {
        long under = bySource.stream().filter(b -> "UNDERPRICED".equals(b.positioning())).count();
        long over = bySource.stream().filter(b -> "OVERPRICED".equals(b.positioning())).count();
        if (under > 0 && over == 0) {
            return "Prix sous le marché selon " + under + " source(s) — marge de hausse possible.";
        }
        if (over > 0 && under == 0) {
            return "Prix au-dessus du marché selon " + over + " source(s) — risque de sous-occupation.";
        }
        if (under > 0) {
            return "Positionnement contrasté selon les sources — arbitrer au cas par cas.";
        }
        return "Prix globalement aligné sur le marché.";
    }
}
