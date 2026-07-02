package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.PropertyService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.portfolio.PortfolioConfig;
import com.clenzy.service.agent.portfolio.PortfolioPatternDetector;
import com.clenzy.service.agent.portfolio.PortfolioPatternEvaluator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Tool {@code analyze_portfolio} — vue d'ensemble cross-property du portefeuille
 * de l'organisation sur une fenetre temporelle (defaut 30 jours).
 *
 * <p><b>Architecture</b> :
 * <ul>
 *   <li>Seuils metier externalises dans {@link PortfolioConfig} (properties Spring,
 *       overridables par env)</li>
 *   <li>Patterns externalises dans {@code resources/patterns/portfolio.yaml} via
 *       {@link PortfolioPatternEvaluator} — ajouter/desactiver un pattern = YAML</li>
 *   <li>Comparaison periode vs periode optionnelle (arg {@code comparePrevious}) :
 *       on re-fetch la fenetre precedente de meme duree et on calcule les deltas</li>
 * </ul>
 *
 * <p>Read-only, pas de confirmation requise.</p>
 */
@Component
public class AnalyzePortfolioTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(AnalyzePortfolioTool.class);
    private static final String NAME = "analyze_portfolio";
    private static final int DEFAULT_DAYS_BACK = 30;
    private static final int MAX_DAYS_BACK = 365;
    private static final String CANCELLED_STATUS = "cancelled";

    private final PropertyService propertyService;
    private final ReservationService reservationService;
    private final GuestReviewRepository guestReviewRepository;
    private final PortfolioConfig portfolioConfig;
    private final PortfolioPatternEvaluator patternEvaluator;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public AnalyzePortfolioTool(PropertyService propertyService,
                                  ReservationService reservationService,
                                  GuestReviewRepository guestReviewRepository,
                                  PortfolioConfig portfolioConfig,
                                  PortfolioPatternEvaluator patternEvaluator,
                                  ObjectMapper objectMapper) {
        this.propertyService = propertyService;
        this.reservationService = reservationService;
        this.guestReviewRepository = guestReviewRepository;
        this.portfolioConfig = portfolioConfig;
        this.patternEvaluator = patternEvaluator;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        int daysBack = Math.min(MAX_DAYS_BACK,
                Math.max(1, args.path("daysBack").asInt(DEFAULT_DAYS_BACK)));
        // comparePrevious : defaut true (compute deltas vs periode N-1)
        boolean comparePrevious = !args.has("comparePrevious")
                || args.path("comparePrevious").asBoolean(true);

        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(daysBack);

        try {
            List<PropertyDto> properties = propertyService.list();
            if (properties == null || properties.isEmpty()) {
                return ToolResult.success(emptyPayloadJson(daysBack, from, to),
                        "portfolio_overview");
            }

            // Phase 1 : metriques periode courante
            Map<Long, PropertyMetrics> currentMetrics = computeMetrics(
                    context, properties, from, to);

            // Phase 2 (optionnelle) : metriques periode precedente pour les deltas
            PeriodAggregates previousAggregates = null;
            if (comparePrevious) {
                LocalDate prevTo = from;
                LocalDate prevFrom = prevTo.minusDays(daysBack);
                try {
                    Map<Long, PropertyMetrics> previousMetrics = computeMetrics(
                            context, properties, prevFrom, prevTo);
                    previousAggregates = aggregate(previousMetrics.values(), daysBack);
                } catch (Exception e) {
                    log.debug("analyze_portfolio : compare previous skipped — {}", e.getMessage());
                }
            }

            return ToolResult.success(
                    buildPayloadJson(currentMetrics.values(), daysBack, from, to, previousAggregates),
                    "portfolio_overview");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize portfolio payload", e);
        } catch (Exception e) {
            log.warn("analyze_portfolio failed: {}", e.getMessage(), e);
            throw new ToolExecutionException(NAME,
                    "Analyse du portefeuille indisponible (" + e.getMessage() + ")", e);
        }
    }

    /**
     * Calcule les metriques par propriete sur une fenetre donnee.
     * Externalisee pour pouvoir etre reappelee sur la fenetre N-1.
     */
    private Map<Long, PropertyMetrics> computeMetrics(AgentContext context,
                                                        List<PropertyDto> properties,
                                                        LocalDate from, LocalDate to) {
        Map<Long, PropertyMetrics> metricsById = new HashMap<>();
        for (PropertyDto p : properties) {
            if (p.id == null) continue;
            metricsById.put(p.id, new PropertyMetrics(p));
        }

        List<Reservation> reservations = reservationService.getReservations(
                context.keycloakId(), null, from, to);
        for (Reservation r : reservations) {
            if (r.getProperty() == null || r.getProperty().getId() == null) continue;
            PropertyMetrics m = metricsById.get(r.getProperty().getId());
            if (m == null) continue;
            m.totalReservations++;
            if (CANCELLED_STATUS.equalsIgnoreCase(r.getStatus())) {
                m.cancelledReservations++;
                continue;
            }
            if (r.getTotalPrice() != null) {
                m.revenue = m.revenue.add(r.getTotalPrice());
            }
            m.bookedNights += nightsInWindow(r, from, to);
        }

        // Ratings : batch query unique pour eviter le N+1 (1 query au lieu de N)
        if (!metricsById.isEmpty()) {
            try {
                List<Long> propertyIds = new ArrayList<>(metricsById.keySet());
                List<Object[]> rows = guestReviewRepository.averageRatingByPropertyIds(
                        propertyIds, context.organizationId());
                for (Object[] row : rows) {
                    Long pid = ((Number) row[0]).longValue();
                    Double avg = row[1] != null ? ((Number) row[1]).doubleValue() : null;
                    PropertyMetrics m = metricsById.get(pid);
                    if (m != null && avg != null) m.avgRating = avg;
                }
            } catch (Exception e) {
                log.debug("AnalyzePortfolio: batch ratings query failed ({}), skipping ratings",
                        e.getMessage());
            }
        }
        return metricsById;
    }

    /** Nombre de nuits de la reservation tombant dans la fenetre [from, to). */
    private static long nightsInWindow(Reservation r, LocalDate from, LocalDate to) {
        LocalDate start = r.getCheckIn();
        LocalDate end = r.getCheckOut();
        if (start == null || end == null) return 0;
        LocalDate clampedStart = start.isBefore(from) ? from : start;
        LocalDate clampedEnd = end.isAfter(to) ? to : end;
        if (!clampedStart.isBefore(clampedEnd)) return 0;
        return ChronoUnit.DAYS.between(clampedStart, clampedEnd);
    }

    /** KPI globaux d'une fenetre — utilises pour calculer les deltas. */
    private PeriodAggregates aggregate(Collection<PropertyMetrics> all, int daysBack) {
        int activeProperties = (int) all.stream()
                .filter(m -> m.property.status == PropertyStatus.ACTIVE)
                .count();
        BigDecimal totalRevenue = all.stream().map(m -> m.revenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long bookedNightsSum = all.stream().mapToLong(m -> m.bookedNights).sum();
        long potentialNights = (long) daysBack * Math.max(1, activeProperties);
        double avgOccupancy = potentialNights > 0
                ? Math.min(1.0, (double) bookedNightsSum / potentialNights)
                : 0.0;
        BigDecimal avgAdr = bookedNightsSum > 0
                ? totalRevenue.divide(BigDecimal.valueOf(bookedNightsSum), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new PeriodAggregates(totalRevenue, avgOccupancy, avgAdr);
    }

    private String buildPayloadJson(Collection<PropertyMetrics> metrics, int daysBack,
                                     LocalDate from, LocalDate to,
                                     PeriodAggregates previous) throws JsonProcessingException {
        List<PropertyMetrics> all = new ArrayList<>(metrics);

        PeriodAggregates current = aggregate(all, daysBack);
        int totalProperties = all.size();
        int activeProperties = (int) all.stream()
                .filter(m -> m.property.status == PropertyStatus.ACTIVE)
                .count();

        // Top performers : tri DESC par revenue, topN configurable
        List<PropertyMetrics> sortedByRevenue = new ArrayList<>(all);
        sortedByRevenue.sort(Comparator.<PropertyMetrics, BigDecimal>comparing(m -> m.revenue).reversed());
        List<Map<String, Object>> topPerformers = sortedByRevenue.stream()
                .filter(m -> m.revenue.signum() > 0)
                .limit(portfolioConfig.getTopN())
                .map(m -> topPerformerItem(m, daysBack))
                .toList();

        // Sous-performants : occupancy < seuil configurable parmi les ACTIVE
        List<Map<String, Object>> underPerformers = new ArrayList<>();
        double underThreshold = portfolioConfig.getUnderPerformerOccupancy();
        for (PropertyMetrics m : all) {
            if (m.property.status != PropertyStatus.ACTIVE) continue;
            double occupancy = m.occupancyOn(daysBack);
            if (occupancy < underThreshold) {
                underPerformers.add(underPerformerItem(m, occupancy, daysBack, underThreshold));
            }
        }

        // Patterns : delegues au evaluator (YAML + detectors strategies)
        List<Map<String, Object>> patterns = patternEvaluator.evaluateAll(
                new PortfolioPatternDetector.PortfolioInput(toDetectorInput(all), portfolioConfig));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title",
                "Vue d'ensemble du portefeuille (" + daysBack + " derniers jours)");
        payload.put("daysBack", daysBack);
        payload.put("from", from.toString());
        payload.put("to", to.toString());
        payload.put("totalProperties", totalProperties);
        payload.put("activeProperties", activeProperties);
        payload.put("totalRevenue", current.totalRevenue.setScale(2, RoundingMode.HALF_UP).doubleValue());
        payload.put("avgOccupancy", round(current.avgOccupancy, 3));
        payload.put("avgADR", current.avgAdr.doubleValue());
        // Deltas vs periode N-1 si fournie
        if (previous != null) {
            Map<String, Object> deltas = new LinkedHashMap<>();
            deltas.put("revenue", roundCurrency(
                    current.totalRevenue.subtract(previous.totalRevenue).doubleValue()));
            deltas.put("revenuePct", percentDelta(previous.totalRevenue.doubleValue(),
                    current.totalRevenue.doubleValue()));
            deltas.put("occupancyPct", round(current.avgOccupancy - previous.avgOccupancy, 3));
            deltas.put("adr", roundCurrency(
                    current.avgAdr.subtract(previous.avgAdr).doubleValue()));
            deltas.put("previousPeriod", Map.of(
                    "totalRevenue", roundCurrency(previous.totalRevenue.doubleValue()),
                    "avgOccupancy", round(previous.avgOccupancy, 3),
                    "avgADR", roundCurrency(previous.avgAdr.doubleValue())));
            payload.put("deltas", deltas);
        }
        payload.put("topPerformers", topPerformers);
        payload.put("underPerformers", underPerformers);
        payload.put("patterns", patterns);
        return objectMapper.writeValueAsString(payload);
    }

    private List<PortfolioPatternDetector.PropertyMetric> toDetectorInput(List<PropertyMetrics> all) {
        List<PortfolioPatternDetector.PropertyMetric> out = new ArrayList<>(all.size());
        for (PropertyMetrics m : all) {
            out.add(new PortfolioPatternDetector.PropertyMetric(
                    m.property.id,
                    m.property.name,
                    m.property.city,
                    m.property.status == null ? null : m.property.status.name(),
                    m.revenue.doubleValue(),
                    m.bookedNights,
                    m.totalReservations,
                    m.cancelledReservations,
                    m.avgRating));
        }
        return out;
    }

    private Map<String, Object> topPerformerItem(PropertyMetrics m, int daysBack) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", m.property.id);
        item.put("name", m.property.name);
        if (m.property.city != null) item.put("city", m.property.city);
        item.put("revenue", m.revenue.setScale(2, RoundingMode.HALF_UP).doubleValue());
        item.put("occupancy", round(m.occupancyOn(daysBack), 3));
        item.put("reservations", m.totalReservations - m.cancelledReservations);
        return item;
    }

    private Map<String, Object> underPerformerItem(PropertyMetrics m, double occupancy,
                                                     int daysBack, double threshold) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", m.property.id);
        item.put("name", m.property.name);
        if (m.property.city != null) item.put("city", m.property.city);
        item.put("occupancy", round(occupancy, 3));
        item.put("reservations", m.totalReservations - m.cancelledReservations);

        String reason;
        String recommendation;
        if (m.totalReservations == 0) {
            reason = "Aucune reservation sur les " + daysBack + " derniers jours";
            recommendation = "Verifier la visibilite (channels actifs ?) et envisager une promotion lancement";
        } else if (occupancy < 0.20) {
            reason = String.format(Locale.ROOT, "Tres faible occupation (%d%%)",
                    Math.round(occupancy * 100));
            recommendation = "Baisser le tarif de base ou activer une regle last-minute -15%";
        } else {
            reason = String.format(Locale.ROOT, "Occupation sous la cible (%d%% < %d%%)",
                    Math.round(occupancy * 100), Math.round(threshold * 100));
            recommendation = "Comparer le tarif aux concurrents et ajuster la duree minimale";
        }
        item.put("reason", reason);
        item.put("recommendation", recommendation);
        return item;
    }

    private String emptyPayloadJson(int daysBack, LocalDate from, LocalDate to)
            throws JsonProcessingException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", "Vue d'ensemble du portefeuille");
        payload.put("daysBack", daysBack);
        payload.put("from", from.toString());
        payload.put("to", to.toString());
        payload.put("totalProperties", 0);
        payload.put("activeProperties", 0);
        payload.put("totalRevenue", 0.0);
        payload.put("avgOccupancy", 0.0);
        payload.put("avgADR", 0.0);
        payload.put("topPerformers", List.of());
        payload.put("underPerformers", List.of());
        payload.put("patterns", List.of());
        return objectMapper.writeValueAsString(payload);
    }

    /** Calcule le % de variation entre l'ancienne et la nouvelle valeur. */
    private static double percentDelta(double previous, double current) {
        if (previous == 0.0) {
            return current == 0.0 ? 0.0 : 1.0; // +100% si on passe de 0 a >0
        }
        return round((current - previous) / Math.abs(previous), 3);
    }

    private static double round(double value, int decimals) {
        return BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).doubleValue();
    }

    private static double roundCurrency(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "daysBack":        {"type":"integer","minimum":1,"maximum":365,"description":"Taille de la fenetre d'analyse en jours (defaut 30, max 365)"},
                        "comparePrevious": {"type":"boolean","description":"Si true (defaut), calcule les deltas vs la meme duree juste avant. Mettre false pour skip ce 2e fetch."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Analyse cross-property du portefeuille : KPI globaux, top/sous-performers, patterns, deltas vs periode precedente. Pour 'vue d'ensemble', 'analyse globale'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }

    // ─── Aggregation state ──────────────────────────────────────────────────

    /** KPI agregees d'une periode — utilise pour les deltas. */
    private record PeriodAggregates(BigDecimal totalRevenue, double avgOccupancy, BigDecimal avgAdr) {}

    /** Etat d'agregation par propriete (visible aux tests). */
    static final class PropertyMetrics {
        final PropertyDto property;
        BigDecimal revenue = BigDecimal.ZERO;
        long bookedNights = 0;
        int totalReservations = 0;
        int cancelledReservations = 0;
        Double avgRating;

        PropertyMetrics(PropertyDto property) {
            this.property = property;
        }

        double occupancyOn(int daysBack) {
            if (daysBack <= 0) return 0.0;
            return Math.min(1.0, (double) bookedNights / daysBack);
        }
    }
}
