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
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code analyze_portfolio} — vue d'ensemble cross-property du portefeuille
 * de l'organisation sur une fenetre temporelle (defaut 30 jours).
 *
 * <p>Agrege par propriete :
 * <ul>
 *   <li>Revenue : somme des {@code Reservation.totalPrice} sur la fenetre (statut != cancelled)</li>
 *   <li>Occupancy : nuits reservees / nuits potentielles</li>
 *   <li>Cancellation rate : reservations cancelled / total</li>
 *   <li>Rating moyen : via {@link GuestReviewRepository#averageRatingByPropertyId}</li>
 * </ul>
 *
 * <p>Detecte ensuite des patterns cross-portfolio :
 * <ul>
 *   <li>Top 3 par revenue</li>
 *   <li>Sous-performants : occupancy &lt; {@value #UNDERPERFORM_OCCUPANCY_THRESHOLD}</li>
 *   <li>Forte volatilite : cancellation rate &gt; {@value #VOLATILITY_CANCEL_THRESHOLD}</li>
 *   <li>Hot spots : villes avec rating moyen &lt; {@value #LOW_RATING_THRESHOLD}</li>
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
    private static final int TOP_N = 3;
    private static final double UNDERPERFORM_OCCUPANCY_THRESHOLD = 0.50;
    private static final double VOLATILITY_CANCEL_THRESHOLD = 0.20;
    private static final double LOW_RATING_THRESHOLD = 3.5;
    private static final String CANCELLED_STATUS = "cancelled";

    private final PropertyService propertyService;
    private final ReservationService reservationService;
    private final GuestReviewRepository guestReviewRepository;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public AnalyzePortfolioTool(PropertyService propertyService,
                                  ReservationService reservationService,
                                  GuestReviewRepository guestReviewRepository,
                                  ObjectMapper objectMapper) {
        this.propertyService = propertyService;
        this.reservationService = reservationService;
        this.guestReviewRepository = guestReviewRepository;
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

        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(daysBack);

        try {
            // 1. Toutes les proprietes de l'org
            List<PropertyDto> properties = propertyService.list();
            if (properties == null || properties.isEmpty()) {
                return ToolResult.success(
                        emptyPayloadJson(daysBack, from, to),
                        "portfolio_overview");
            }

            // 2. Toutes les reservations de l'user/role sur la fenetre
            List<Reservation> reservations = reservationService.getReservations(
                    context.keycloakId(), null, from, to);

            // 3. Aggregate par propertyId
            Map<Long, PropertyMetrics> metricsById = new HashMap<>();
            for (PropertyDto p : properties) {
                if (p.id == null) continue;
                metricsById.put(p.id, new PropertyMetrics(p));
            }

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

            // 4. Enrichir avec rating (par propriete, depuis le repo)
            for (PropertyMetrics m : metricsById.values()) {
                Double avg = guestReviewRepository.averageRatingByPropertyId(
                        m.property.id, context.organizationId());
                if (avg != null) m.avgRating = avg;
            }

            // 5. KPI globaux + categorisation
            return ToolResult.success(
                    buildPayloadJson(metricsById.values(), daysBack, from, to),
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
     * Nombre de nuits de la reservation tombant dans la fenetre [from, to).
     * Si le sejour deborde de la fenetre, on ne compte que la partie incluse.
     */
    private static long nightsInWindow(Reservation r, LocalDate from, LocalDate to) {
        LocalDate start = r.getCheckIn();
        LocalDate end = r.getCheckOut();
        if (start == null || end == null) return 0;
        LocalDate clampedStart = start.isBefore(from) ? from : start;
        LocalDate clampedEnd = end.isAfter(to) ? to : end;
        if (!clampedStart.isBefore(clampedEnd)) return 0;
        return ChronoUnit.DAYS.between(clampedStart, clampedEnd);
    }

    private String buildPayloadJson(Iterable<PropertyMetrics> metrics, int daysBack,
                                     LocalDate from, LocalDate to) throws JsonProcessingException {
        List<PropertyMetrics> all = new ArrayList<>();
        metrics.forEach(all::add);

        int totalProperties = all.size();
        int activeProperties = (int) all.stream()
                .filter(m -> m.property.status == PropertyStatus.ACTIVE)
                .count();

        BigDecimal totalRevenue = all.stream()
                .map(m -> m.revenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long bookedNightsSum = all.stream().mapToLong(m -> m.bookedNights).sum();
        // Nuits potentielles = nb de jours × nb proprietes actives (les inactives
        // ne devraient pas penaliser l'occupancy moyenne)
        long potentialNights = (long) daysBack * Math.max(1, activeProperties);
        double avgOccupancy = potentialNights > 0
                ? Math.min(1.0, (double) bookedNightsSum / potentialNights)
                : 0.0;

        // ADR = revenue / booked nights
        BigDecimal avgAdr = bookedNightsSum > 0
                ? totalRevenue.divide(BigDecimal.valueOf(bookedNightsSum), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Top performers : tri DESC par revenue, top 3
        List<PropertyMetrics> sortedByRevenue = new ArrayList<>(all);
        sortedByRevenue.sort(Comparator.<PropertyMetrics, BigDecimal>comparing(m -> m.revenue).reversed());
        List<Map<String, Object>> topPerformers = sortedByRevenue.stream()
                .filter(m -> m.revenue.signum() > 0)
                .limit(TOP_N)
                .map(m -> topPerformerItem(m, daysBack))
                .toList();

        // Sous-performants : occupancy < seuil parmi les ACTIVE (sur fenetre)
        List<Map<String, Object>> underPerformers = new ArrayList<>();
        for (PropertyMetrics m : all) {
            if (m.property.status != PropertyStatus.ACTIVE) continue;
            double occupancy = m.occupancyOn(daysBack);
            if (occupancy < UNDERPERFORM_OCCUPANCY_THRESHOLD) {
                underPerformers.add(underPerformerItem(m, occupancy, daysBack));
            }
        }

        // Patterns cross
        List<Map<String, Object>> patterns = detectPatterns(all);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title",
                "Vue d'ensemble du portefeuille (" + daysBack + " derniers jours)");
        payload.put("daysBack", daysBack);
        payload.put("from", from.toString());
        payload.put("to", to.toString());
        payload.put("totalProperties", totalProperties);
        payload.put("activeProperties", activeProperties);
        payload.put("totalRevenue", totalRevenue.setScale(2, RoundingMode.HALF_UP).doubleValue());
        payload.put("avgOccupancy", round(avgOccupancy, 3));
        payload.put("avgADR", avgAdr.doubleValue());
        payload.put("topPerformers", topPerformers);
        payload.put("underPerformers", underPerformers);
        payload.put("patterns", patterns);

        return objectMapper.writeValueAsString(payload);
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

    private Map<String, Object> underPerformerItem(PropertyMetrics m, double occupancy, int daysBack) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", m.property.id);
        item.put("name", m.property.name);
        if (m.property.city != null) item.put("city", m.property.city);
        item.put("occupancy", round(occupancy, 3));
        item.put("reservations", m.totalReservations - m.cancelledReservations);

        // Raison + recommandation contextuelles
        String reason;
        String recommendation;
        if (m.totalReservations == 0) {
            reason = "Aucune reservation sur les " + daysBack + " derniers jours";
            recommendation = "Verifier la visibilite (channels actifs ?) et envisager une promotion lancement";
        } else if (occupancy < 0.20) {
            reason = "Tres faible occupation (" + Math.round(occupancy * 100) + "%)";
            recommendation = "Baisser le tarif de base ou activer une regle last-minute -15%";
        } else {
            reason = "Occupation sous la cible (" + Math.round(occupancy * 100) + "% < 50%)";
            recommendation = "Comparer le tarif aux concurrents et ajuster la duree minimale";
        }
        item.put("reason", reason);
        item.put("recommendation", recommendation);
        return item;
    }

    private List<Map<String, Object>> detectPatterns(List<PropertyMetrics> all) {
        List<Map<String, Object>> patterns = new ArrayList<>();

        // Pattern 1 : forte volatilite (cancellation rate)
        List<String> volatileProps = new ArrayList<>();
        for (PropertyMetrics m : all) {
            if (m.totalReservations < 3) continue;
            double cancelRate = (double) m.cancelledReservations / m.totalReservations;
            if (cancelRate > VOLATILITY_CANCEL_THRESHOLD) {
                volatileProps.add(m.property.name + " (" + Math.round(cancelRate * 100) + "%)");
            }
        }
        if (!volatileProps.isEmpty()) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("type", "HIGH_CANCELLATION_RATE");
            p.put("severity", volatileProps.size() >= 3 ? "HIGH" : "MEDIUM");
            p.put("title", "Taux d'annulation eleve");
            p.put("description", volatileProps.size() + " propriete(s) avec >20% d'annulations");
            p.put("items", volatileProps);
            patterns.add(p);
        }

        // Pattern 2 : satisfaction faible par ville
        Map<String, List<Double>> ratingsByCity = new HashMap<>();
        for (PropertyMetrics m : all) {
            if (m.property.city == null || m.avgRating == null) continue;
            ratingsByCity.computeIfAbsent(m.property.city, k -> new ArrayList<>()).add(m.avgRating);
        }
        List<String> lowRatingCities = new ArrayList<>();
        for (Map.Entry<String, List<Double>> e : ratingsByCity.entrySet()) {
            double avg = e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0);
            if (avg < LOW_RATING_THRESHOLD && !e.getValue().isEmpty()) {
                lowRatingCities.add(e.getKey() + " (" + round(avg, 2) + "/5)");
            }
        }
        if (!lowRatingCities.isEmpty()) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("type", "CITY_SATISFACTION_LOW");
            p.put("severity", "HIGH");
            p.put("title", "Satisfaction faible par ville");
            p.put("description", lowRatingCities.size()
                    + " ville(s) avec rating moyen <3.5/5");
            p.put("items", lowRatingCities);
            patterns.add(p);
        }

        return patterns;
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

    private static double round(double value, int decimals) {
        return BigDecimal.valueOf(value)
                .setScale(decimals, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "daysBack": {"type":"integer","minimum":1,"maximum":365,"description":"Taille de la fenetre d'analyse en jours (defaut 30, max 365)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Vue d'ensemble cross-property du portefeuille : KPI globaux, top performers, proprietes sous-performantes, patterns detectes (volatilite, satisfaction par ville). Utiliser quand l'user demande 'vue d'ensemble', 'tout mon portfolio', 'compare mes proprietes', 'analyse globale'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }

    // ─── Aggregation state ──────────────────────────────────────────────────

    /**
     * Etat d'agregation par propriete (visible aux tests pour faciliter
     * la validation des comptages).
     */
    static final class PropertyMetrics {
        final PropertyDto property;
        BigDecimal revenue = BigDecimal.ZERO;
        long bookedNights = 0;
        int totalReservations = 0;
        int cancelledReservations = 0;
        Double avgRating; // null = pas de reviews

        PropertyMetrics(PropertyDto property) {
            this.property = property;
        }

        double occupancyOn(int daysBack) {
            if (daysBack <= 0) return 0.0;
            return Math.min(1.0, (double) bookedNights / daysBack);
        }
    }
}
