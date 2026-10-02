package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.dto.AiInsightDto;
import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.dto.PeriodComparisonDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AiAnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AiAnalyticsService.class);

    // Seasonal coefficients (Mediterranean/European market)
    private static final Map<Month, String> SEASON_MAP = Map.ofEntries(
        Map.entry(Month.JANUARY, "LOW"),
        Map.entry(Month.FEBRUARY, "LOW"),
        Map.entry(Month.MARCH, "MID"),
        Map.entry(Month.APRIL, "MID"),
        Map.entry(Month.MAY, "HIGH"),
        Map.entry(Month.JUNE, "HIGH"),
        Map.entry(Month.JULY, "HIGH"),
        Map.entry(Month.AUGUST, "HIGH"),
        Map.entry(Month.SEPTEMBER, "HIGH"),
        Map.entry(Month.OCTOBER, "MID"),
        Map.entry(Month.NOVEMBER, "LOW"),
        Map.entry(Month.DECEMBER, "MID")
    );

    private static final Map<String, Double> SEASON_BASE_OCCUPANCY = Map.of(
        "HIGH", 0.75,
        "MID", 0.50,
        "LOW", 0.30
    );

    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final AiProperties aiProperties;
    private final AiProviderRouter aiProviderRouter;
    private final AiAnonymizationService anonymizationService;
    private final AiTokenBudgetService tokenBudgetService;
    private final ObjectMapper objectMapper;
    private final CurrencyConverterService currencyConverter;
    private final CalendarDayRepository calendarDayRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public AiAnalyticsService(ReservationRepository reservationRepository,
                               PropertyRepository propertyRepository,
                               AiProperties aiProperties,
                               AiProviderRouter aiProviderRouter,
                               AiAnonymizationService anonymizationService,
                               AiTokenBudgetService tokenBudgetService,
                               ObjectMapper objectMapper,
                               CurrencyConverterService currencyConverter,
                               CalendarDayRepository calendarDayRepository,
                               OrganizationAccessGuard organizationAccessGuard) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.aiProperties = aiProperties;
        this.aiProviderRouter = aiProviderRouter;
        this.anonymizationService = anonymizationService;
        this.tokenBudgetService = tokenBudgetService;
        this.objectMapper = objectMapper;
        this.currencyConverter = currencyConverter;
        this.calendarDayRepository = calendarDayRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Analytics complets pour une propriete sur une periode donnee.
     */
    public RevenueAnalyticsDto getAnalytics(Long propertyId, Long orgId,
                                              LocalDate from, LocalDate to) {
        return getAnalytics(propertyId, orgId, from, to, null);
    }

    /**
     * Analytics complets avec devise de reporting (CLZ-P0-14) : chaque reservation est
     * convertie a sa date dans {@code reportingCurrency} (defaut = devise de la propriete),
     * pour une consolidation portefeuille multi-pays (EUR/MAD/SAR) coherente.
     *
     * <p>Definitions metier standard (Baitly Academie ep. 01), identiques pour N et N-1 :
     * <ul>
     *   <li>nuits disponibles = nuits proposees a la vente, hors blocages BLOCKED/MAINTENANCE
     *       du calendrier ;</li>
     *   <li>revenu = CA hebergement seul (hors menage, taxe de sejour, options), proratise
     *       aux nuits du sejour comprises dans [from, to) ;</li>
     *   <li>occupation = nuits vendues / nuits disponibles ; ADR = revenu / nuits vendues ;
     *       RevPAR = revenu / nuits disponibles ; reservations annulees exclues.</li>
     * </ul>
     * Toutes les bornes sont des {@link LocalDate} de calendrier de la propriete (checkIn,
     * checkOut, jours du calendrier) : aucune conversion de fuseau n'intervient ici.</p>
     */
    public RevenueAnalyticsDto getAnalytics(Long propertyId, Long orgId,
                                              LocalDate from, LocalDate to, String reportingCurrency) {
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));
        // findById contourne le filtre Hibernate : le logement doit appartenir a l'org de l'appelant.
        organizationAccessGuard.requireSameOrganization(
            property.getOrganizationId(), orgId, "Logement " + propertyId);

        String currency = resolveReportingCurrency(reportingCurrency, property);

        List<Reservation> reservations = findStays(propertyId, orgId, from, to);
        Set<LocalDate> closedDates = findClosedDates(propertyId, orgId, from, to);
        PeriodKpis kpis = computeKpis(from, to, reservations, closedDates, currency);

        // Monthly breakdowns (memes definitions que les KPI de la periode)
        Map<String, Double> occupancyByMonth = calculateOccupancyByMonth(from, to, reservations, closedDates);
        Map<String, BigDecimal> revenueByMonth = calculateRevenueByMonth(from, to, reservations, currency);
        Map<String, Integer> bookingsBySource = calculateBookingsBySource(reservations);

        // Forecast for next 30 days after 'to'
        List<OccupancyForecastDto> forecast = getForecast(propertyId, to, to.plusDays(30), reservations);

        // Comparaison N vs N-1 calculee serveur (CLZ-P0-13) — source unique opposable du delta.
        PeriodComparisonDto comparison = buildYoYComparison(propertyId, orgId, from, to, kpis, currency);

        return new RevenueAnalyticsDto(
            propertyId, from, to, kpis.totalNights(), kpis.availableNights(), kpis.bookedNights(),
            kpis.occupancyRate(), kpis.revenue(), kpis.adr(), kpis.revPar(),
            occupancyByMonth, revenueByMonth, bookingsBySource, forecast, comparison, currency
        );
    }

    /**
     * Comparaison annuelle (N vs N-1) : recalcule les metriques sur la meme periode
     * decalee d'un an, via le MEME {@link #computeKpis} que la periode courante, et expose
     * current/previous/growth%. BigDecimal.compareTo (jamais equals) + RoundingMode
     * explicite (audit #10).
     */
    private PeriodComparisonDto buildYoYComparison(Long propertyId, Long orgId,
            LocalDate from, LocalDate to, PeriodKpis current, String reportingCurrency) {
        LocalDate prevFrom = from.minusYears(1);
        LocalDate prevTo = to.minusYears(1);
        PeriodKpis previous = computeKpis(prevFrom, prevTo,
            findStays(propertyId, orgId, prevFrom, prevTo),
            findClosedDates(propertyId, orgId, prevFrom, prevTo),
            reportingCurrency);

        return new PeriodComparisonDto(prevFrom, prevTo, "YEAR_OVER_YEAR",
            metricComparison(current.revenue(), previous.revenue()),
            metricComparison(current.adr(), previous.adr()),
            metricComparison(current.revPar(), previous.revPar()),
            metricComparison(BigDecimal.valueOf(current.occupancyRate()),
                BigDecimal.valueOf(previous.occupancyRate())));
    }

    /** KPI d'une periode [from, to). */
    private record PeriodKpis(int totalNights, int availableNights, int bookedNights,
                              double occupancyRate, BigDecimal revenue, BigDecimal adr, BigDecimal revPar) {}

    private PeriodKpis computeKpis(LocalDate from, LocalDate to, List<Reservation> reservations,
                                   Set<LocalDate> closedDates, String reportingCurrency) {
        int totalNights = (int) ChronoUnit.DAYS.between(from, to);
        if (totalNights <= 0) totalNights = 1;

        Set<LocalDate> bookedDates = AccommodationKpis.soldNights(reservations, from, to);
        // Une nuit vendue malgre un blocage (conflit d'import OTA) etait bien en vente :
        // seules les nuits fermees ET non vendues sortent du denominateur (occupation <= 100 %).
        int availableNights = totalNights
            - AccommodationKpis.closedUnsoldNights(closedDates, bookedDates, from, to);
        int bookedNights = bookedDates.size();

        double occupancyRate = availableNights > 0
            ? Math.min(1.0, (double) bookedNights / availableNights)
            : 0.0;
        BigDecimal revenue = calculateTotalRevenue(reservations, from, to, reportingCurrency);
        BigDecimal adr = bookedNights > 0
            ? revenue.divide(BigDecimal.valueOf(bookedNights), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        BigDecimal revPar = availableNights > 0
            ? revenue.divide(BigDecimal.valueOf(availableNights), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        return new PeriodKpis(totalNights, availableNights, bookedNights, occupancyRate, revenue, adr, revPar);
    }

    /**
     * Sejours non annules chevauchant la periode. La requete inclut aussi les sejours
     * qui ne font que toucher les bornes (depart le {@code from}, arrivee le {@code to}) :
     * ils n'ont aucune nuit dans [from, to) et ne portent donc ni nuit ni revenu.
     */
    private List<Reservation> findStays(Long propertyId, Long orgId, LocalDate from, LocalDate to) {
        return reservationRepository.findByPropertyIdsAndDateRange(List.of(propertyId), from, to, orgId)
            .stream()
            .filter(r -> !AccommodationKpis.isCancelled(r))
            .toList();
    }

    /** Nuits retirees de la vente sur [from, to) : blocage proprietaire (BLOCKED) ou travaux (MAINTENANCE). */
    private Set<LocalDate> findClosedDates(Long propertyId, Long orgId, LocalDate from, LocalDate to) {
        return calendarDayRepository.findBlockedOrMaintenanceForProperties(List.of(propertyId), from, to, orgId)
            .stream()
            .map(CalendarDay::getDate)
            .collect(Collectors.toSet());
    }

    private PeriodComparisonDto.MetricComparison metricComparison(BigDecimal current, BigDecimal previous) {
        BigDecimal cur = current != null ? current : BigDecimal.ZERO;
        BigDecimal prev = previous != null ? previous : BigDecimal.ZERO;
        BigDecimal growthPct;
        if (prev.compareTo(BigDecimal.ZERO) == 0) {
            growthPct = cur.compareTo(BigDecimal.ZERO) > 0 ? BigDecimal.valueOf(100) : BigDecimal.ZERO;
        } else {
            growthPct = cur.subtract(prev)
                .divide(prev.abs(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
        }
        return new PeriodComparisonDto.MetricComparison(cur, prev, growthPct);
    }

    /**
     * Previsions d'occupation pour une propriete sur une periode.
     */
    public List<OccupancyForecastDto> getForecast(Long propertyId, LocalDate from, LocalDate to,
                                                     List<Reservation> historicalReservations) {
        List<OccupancyForecastDto> forecasts = new ArrayList<>();
        LocalDate current = from;

        while (!current.isAfter(to)) {
            forecasts.add(forecastForDate(propertyId, current, historicalReservations));
            current = current.plusDays(1);
        }
        return forecasts;
    }

    /**
     * Prediction d'occupation pour une date specifique.
     */
    OccupancyForecastDto forecastForDate(Long propertyId, LocalDate date,
                                                 List<Reservation> historicalReservations) {
        boolean isBooked = isDateBooked(date, historicalReservations);
        String dayType = getDayType(date);
        String season = getSeason(date);

        if (isBooked) {
            return new OccupancyForecastDto(
                propertyId, date, 1.0, 1.0, true, dayType, season, "Already booked"
            );
        }

        // Predict based on historical patterns + season + day type
        double baseOccupancy = SEASON_BASE_OCCUPANCY.getOrDefault(season, 0.5);
        double historicalFactor = calculateHistoricalFactor(date, historicalReservations);
        double dayTypeFactor = getDayTypeFactor(dayType);

        double predicted = Math.min(1.0, baseOccupancy * historicalFactor * dayTypeFactor);
        predicted = Math.round(predicted * 100.0) / 100.0;

        double confidence = calculateForecastConfidence(date, historicalReservations);

        String reason = buildForecastReason(season, dayType, historicalFactor);

        return new OccupancyForecastDto(
            propertyId, date, predicted, confidence, false, dayType, season, reason
        );
    }

    // ---- Calculation helpers ----

    int calculateBookedNights(LocalDate from, LocalDate to, List<Reservation> reservations) {
        return AccommodationKpis.soldNights(reservations, from, to).size();
    }

    private static String monthKey(LocalDate date) {
        return date.getMonth().getDisplayName(TextStyle.SHORT, Locale.FRENCH) + " " + date.getYear();
    }

    // ---- Consolidation multi-devise (CLZ-P0-14) ----

    private String resolveReportingCurrency(String requested, Property property) {
        if (requested != null && !requested.isBlank()) {
            return requested.trim().toUpperCase(Locale.ROOT);
        }
        String propCurrency = property.getDefaultCurrency();
        return (propCurrency != null && !propCurrency.isBlank())
            ? propCurrency.trim().toUpperCase(Locale.ROOT) : "EUR";
    }

    /** Date du taux de change d'une reservation : paiement, sinon arrivee, sinon creation (audit #10, taux fige). */
    private LocalDate rateDate(Reservation r) {
        if (r.getPaidAt() != null) return r.getPaidAt().toLocalDate();
        if (r.getCheckIn() != null) return r.getCheckIn();
        if (r.getCreatedAt() != null) return r.getCreatedAt().toLocalDate();
        return LocalDate.now();
    }

    private BigDecimal toReportingCurrency(BigDecimal amount, Reservation r, String reportingCurrency) {
        if (amount == null) return BigDecimal.ZERO;
        String from = (r.getCurrency() != null && !r.getCurrency().isBlank())
            ? r.getCurrency() : reportingCurrency;
        if (reportingCurrency == null || from.equalsIgnoreCase(reportingCurrency)) {
            return amount;
        }
        return currencyConverter.convert(amount, from, reportingCurrency, rateDate(r));
    }

    /** CA hebergement proratise a [from, to), converti dans la devise de reporting (CLZ-P0-14). */
    BigDecimal calculateTotalRevenue(List<Reservation> reservations, LocalDate from, LocalDate to,
                                     String reportingCurrency) {
        BigDecimal total = BigDecimal.ZERO;
        for (Reservation r : reservations) {
            total = total.add(AccommodationKpis.proratedAccommodationRevenue(r, from, to,
                amount -> toReportingCurrency(amount, r, reportingCurrency)));
        }
        return total;
    }

    /**
     * CA hebergement par mois de la periode : chaque nuit est rattachee a son mois (un sejour
     * du 29 mars au 3 avril se repartit entre mars et avril). Mois sans revenu omis.
     */
    Map<String, BigDecimal> calculateRevenueByMonth(LocalDate from, LocalDate to,
                                                    List<Reservation> reservations, String reportingCurrency) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        LocalDate monthStart = from;
        while (monthStart.isBefore(to)) {
            LocalDate nextMonth = monthStart.withDayOfMonth(1).plusMonths(1);
            LocalDate monthEnd = nextMonth.isBefore(to) ? nextMonth : to;
            BigDecimal revenue = calculateTotalRevenue(reservations, monthStart, monthEnd, reportingCurrency);
            if (revenue.signum() > 0) {
                result.put(monthKey(monthStart), revenue);
            }
            monthStart = nextMonth;
        }
        return result;
    }

    /** Occupation par mois = nuits vendues / nuits proposees a la vente du mois (0 si mois entierement ferme). */
    Map<String, Double> calculateOccupancyByMonth(LocalDate from, LocalDate to,
                                                     List<Reservation> reservations, Set<LocalDate> closedDates) {
        Map<String, Integer> availableDaysByMonth = new LinkedHashMap<>();
        Map<String, Integer> bookedDaysByMonth = new LinkedHashMap<>();
        Set<LocalDate> bookedDates = AccommodationKpis.soldNights(reservations, from, to);

        LocalDate d = from;
        while (d.isBefore(to)) {
            String monthKey = monthKey(d);
            boolean booked = bookedDates.contains(d);
            // Meme regle que computeKpis : une nuit vendue compte comme disponible, meme bloquee.
            availableDaysByMonth.merge(monthKey, booked || !closedDates.contains(d) ? 1 : 0, Integer::sum);
            if (booked) {
                bookedDaysByMonth.merge(monthKey, 1, Integer::sum);
            }
            d = d.plusDays(1);
        }

        Map<String, Double> result = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : availableDaysByMonth.entrySet()) {
            int booked = bookedDaysByMonth.getOrDefault(entry.getKey(), 0);
            double rate = entry.getValue() > 0 ? (double) booked / entry.getValue() : 0.0;
            result.put(entry.getKey(), Math.round(rate * 100.0) / 100.0);
        }
        return result;
    }

    Map<String, Integer> calculateBookingsBySource(List<Reservation> reservations) {
        return reservations.stream()
            .collect(Collectors.groupingBy(
                r -> r.getSource() != null ? r.getSource() : "other",
                Collectors.collectingAndThen(Collectors.counting(), Long::intValue)
            ));
    }

    boolean isDateBooked(LocalDate date, List<Reservation> reservations) {
        return reservations.stream()
            .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
            .anyMatch(r -> !date.isBefore(r.getCheckIn()) && date.isBefore(r.getCheckOut()));
    }

    String getDayType(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        if (dow == DayOfWeek.FRIDAY || dow == DayOfWeek.SATURDAY) {
            return "WEEKEND";
        }
        return "WEEKDAY";
    }

    String getSeason(LocalDate date) {
        return SEASON_MAP.getOrDefault(date.getMonth(), "MID");
    }

    double getDayTypeFactor(String dayType) {
        return "WEEKEND".equals(dayType) ? 1.20 : 1.0;
    }

    /**
     * Calcule un facteur d'ajustement base sur les reservations historiques
     * pour la meme periode de l'annee precedente.
     */
    double calculateHistoricalFactor(LocalDate date, List<Reservation> historicalReservations) {
        if (historicalReservations.isEmpty()) return 1.0;

        long matchingBookings = historicalReservations.stream()
            .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
            .filter(r -> {
                int dayOfYear = date.getDayOfYear();
                int checkInDay = r.getCheckIn().getDayOfYear();
                return Math.abs(dayOfYear - checkInDay) <= 21; // 3-week window
            })
            .count();

        // More historical bookings in same period = higher factor
        if (matchingBookings >= 5) return 1.3;
        if (matchingBookings >= 3) return 1.15;
        if (matchingBookings >= 1) return 1.0;
        return 0.8; // No historical data for this period = lower prediction
    }

    double calculateForecastConfidence(LocalDate date, List<Reservation> historicalReservations) {
        double dataConfidence = Math.min(1.0, historicalReservations.size() / 15.0);
        long daysAhead = ChronoUnit.DAYS.between(LocalDate.now(), date);
        double timeConfidence;
        if (daysAhead <= 0) timeConfidence = 0.95;
        else if (daysAhead <= 7) timeConfidence = 0.85;
        else if (daysAhead <= 30) timeConfidence = 0.65;
        else timeConfidence = 0.40;

        return Math.round((dataConfidence * 0.5 + timeConfidence * 0.5) * 100.0) / 100.0;
    }

    String buildForecastReason(String season, String dayType, double historicalFactor) {
        StringBuilder reason = new StringBuilder();
        reason.append(switch (season) {
            case "HIGH" -> "High season";
            case "LOW" -> "Low season";
            default -> "Mid season";
        });

        if ("WEEKEND".equals(dayType)) {
            reason.append(" + weekend");
        }

        if (historicalFactor >= 1.3) {
            reason.append(" + strong historical demand");
        } else if (historicalFactor <= 0.8) {
            reason.append(" + limited historical data");
        }

        return reason.toString();
    }

    // ─── AI-powered insights ──────────────────────────────────────────

    @CircuitBreaker(name = "ai-analytics")
    @Retry(name = "ai-analytics")
    public List<AiInsightDto> getAiInsights(Long propertyId, Long orgId,
                                              LocalDate from, LocalDate to) {
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.ANALYTICS);
        ResolvedTarget key = aiProviderRouter.resolveKey(orgId, "anthropic", AiFeature.ANALYTICS);
        tokenBudgetService.requireBudget(orgId, AiFeature.ANALYTICS, key.source());

        // Build analytics data to send to AI
        RevenueAnalyticsDto analytics = getAnalytics(propertyId, orgId, from, to);

        String userPrompt = AiAnalyticsPrompts.buildUserPrompt(
            propertyId, from, to,
            analytics.availableNights(), analytics.bookedNights(),
            analytics.occupancyRate(),
            analytics.totalRevenue(), analytics.averageDailyRate(), analytics.revPar(),
            analytics.occupancyByMonth(), analytics.revenueByMonth(), analytics.bookingsBySource()
        );

        String anonymized = anonymizationService.anonymize(userPrompt);

        AiRequest request = AiRequest.of(AiAnalyticsPrompts.SYSTEM_PROMPT, anonymized);
        RoutedResponse routed = aiProviderRouter.route(orgId, "anthropic", AiFeature.ANALYTICS, request);

        tokenBudgetService.recordUsage(orgId, AiFeature.ANALYTICS, routed.providerName(), routed.response());

        try {
            return objectMapper.readValue(
                routed.response().content(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, AiInsightDto.class)
            );
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI analytics insights: {}", e.getMessage());
            throw new AiProviderException(routed.providerName(), "Failed to parse analytics insights", e);
        }
    }
}
