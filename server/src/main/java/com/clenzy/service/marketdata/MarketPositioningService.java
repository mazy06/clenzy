package com.clenzy.service.marketdata;

import com.clenzy.dto.MarketPositioningDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MarketDataSnapshot;
import com.clenzy.model.Property;
import com.clenzy.repository.MarketDataSnapshotRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.PropertyPerformanceService;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Positionnement d'un bien face au marché (consommateur du market data) —
 * remplace l'ancien {@code CompetitionBenchmarkService} (supprimé avec PriceLabs)
 * en lisant les <b>vrais benchmarks</b> persistés dans {@code market_data_snapshots}.
 *
 * <p>Produit le <b>double signal</b> de la roadmap : le réalisé du bien (prix
 * publié moyen résolu par le PriceEngine + occupation à venir) vs le benchmark de
 * sa zone, en choisissant la source la plus fiable (confiance la plus haute) pour
 * le mois courant. Read-only, org-scopé (fail-closed). Ne modifie aucun prix.</p>
 */
@Service
public class MarketPositioningService {

    /** Horizon du prix publié moyen du bien (nuits à venir). */
    private static final int PRICE_HORIZON_DAYS = 30;
    /** Bandes de positionnement : ±5 % autour du marché = aligné. */
    private static final double ALIGNED_BAND_PCT = 5.0;

    private final PropertyRepository propertyRepository;
    private final MarketDataSnapshotRepository snapshotRepository;
    private final PriceEngine priceEngine;
    private final PropertyPerformanceService performanceService;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final Clock clock;

    public MarketPositioningService(PropertyRepository propertyRepository,
                                    MarketDataSnapshotRepository snapshotRepository,
                                    PriceEngine priceEngine,
                                    PropertyPerformanceService performanceService,
                                    OrganizationAccessGuard organizationAccessGuard,
                                    Clock clock) {
        this.propertyRepository = propertyRepository;
        this.snapshotRepository = snapshotRepository;
        this.priceEngine = priceEngine;
        this.performanceService = performanceService;
        this.organizationAccessGuard = organizationAccessGuard;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MarketPositioningDto position(Long propertyId, Long orgId) {
        final Property property = propertyRepository.findByIdWithOwnerNoOrgFilter(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        // findById* contourne le filtre org (audit F1) : garde d'ownership fail-closed.
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Logement hors de votre organisation");

        final String area = property.getCity();
        final String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";
        final BigDecimal propertyAdr = averagePublishedPrice(propertyId, orgId);
        final double propertyOccupancy = performanceService.forwardOccupancyRate(propertyId, PRICE_HORIZON_DAYS);

        final MarketDataSnapshot benchmark = bestBenchmark(area, currency);
        if (benchmark == null || benchmark.getAdr() == null) {
            return new MarketPositioningDto(area, propertyAdr, propertyOccupancy,
                    null, null, currency, null, "NO_MARKET_DATA", null, null,
                    area == null || area.isBlank()
                            ? "Ville du logement non renseignée — comparaison marché impossible."
                            : "Aucune donnée de marché disponible pour " + area + " (source à activer ou densité insuffisante).");
        }

        final Double deltaPct = propertyAdr != null && propertyAdr.signum() > 0
                ? round1((propertyAdr.subtract(benchmark.getAdr()))
                    .multiply(BigDecimal.valueOf(100))
                    .divide(benchmark.getAdr(), 4, RoundingMode.HALF_UP).doubleValue())
                : null;
        final String positioning = positioningOf(deltaPct);

        return new MarketPositioningDto(
                area, propertyAdr, propertyOccupancy,
                benchmark.getAdr(), benchmark.getOccupancyPct(), currency,
                deltaPct, positioning, benchmark.getSource(), benchmark.getConfidence(),
                headline(area, deltaPct, positioning, benchmark));
    }

    /** Prix publié moyen résolu par la cascade sur l'horizon à venir. */
    private BigDecimal averagePublishedPrice(Long propertyId, Long orgId) {
        final LocalDate today = LocalDate.now(clock);
        final Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(
                propertyId, today, today.plusDays(PRICE_HORIZON_DAYS), orgId);
        final List<BigDecimal> values = prices.values().stream().filter(p -> p != null).toList();
        if (values.isEmpty()) {
            return null;
        }
        final BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    /** Meilleure cellule marché : mois courant si dispo, sinon la plus récente ; confiance max. */
    private MarketDataSnapshot bestBenchmark(String area, String currency) {
        if (area == null || area.isBlank()) {
            return null;
        }
        final String currentMonth = YearMonth.from(LocalDate.now(clock)).toString();
        final List<MarketDataSnapshot> cells = snapshotRepository.findLatestByArea(area).stream()
                .filter(s -> s.getCurrency() == null || s.getCurrency().equals(currency))
                .toList();
        return cells.stream()
                .filter(s -> currentMonth.equals(s.getStayMonth()))
                .max(Comparator.comparing(this::confidence))
                .orElseGet(() -> cells.stream().max(Comparator.comparing(this::confidence)).orElse(null));
    }

    private BigDecimal confidence(MarketDataSnapshot s) {
        return s.getConfidence() != null ? s.getConfidence() : BigDecimal.ZERO;
    }

    static String positioningOf(Double deltaPct) {
        if (deltaPct == null) {
            return "ALIGNED";
        }
        if (deltaPct < -ALIGNED_BAND_PCT) {
            return "UNDERPRICED";
        }
        if (deltaPct > ALIGNED_BAND_PCT) {
            return "OVERPRICED";
        }
        return "ALIGNED";
    }

    private static String headline(String area, Double deltaPct, String positioning,
                                   MarketDataSnapshot benchmark) {
        final String src = "source " + benchmark.getSource().toLowerCase()
                + ", confiance " + (benchmark.getConfidence() != null
                        ? Math.round(benchmark.getConfidence().doubleValue() * 100) + " %" : "n/a");
        if (deltaPct == null) {
            return "Prix du logement indisponible pour comparer à " + area + " (" + src + ").";
        }
        final String sign = deltaPct > 0 ? "+" : "";
        return switch (positioning) {
            case "UNDERPRICED" -> "Sous le marché de " + area + " (" + sign + Math.round(deltaPct)
                    + " %) — marge de hausse possible (" + src + ").";
            case "OVERPRICED" -> "Au-dessus du marché de " + area + " (" + sign + Math.round(deltaPct)
                    + " %) — vérifier le taux de conversion (" + src + ").";
            default -> "Aligné sur le marché de " + area + " (" + sign + Math.round(deltaPct)
                    + " %, " + src + ").";
        };
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
