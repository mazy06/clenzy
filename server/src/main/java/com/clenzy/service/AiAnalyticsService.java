package com.clenzy.service;

import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
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

    public AiAnalyticsService(ReservationRepository reservationRepository,
                               PropertyRepository propertyRepository) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
    }

    /**
     * Analytics complets pour une propriete sur une periode donnee.
     */
    public RevenueAnalyticsDto getAnalytics(Long propertyId, Long orgId,
                                              LocalDate from, LocalDate to) {
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));

        List<Reservation> reservations = reservationRepository.findByPropertyIdsAndDateRange(
            List.of(propertyId), from, to, orgId);

        int totalNights = (int) ChronoUnit.DAYS.between(from, to);
        if (totalNights <= 0) totalNights = 1;

        // Calculate booked nights
        int bookedNights = calculateBookedNights(from, to, reservations);
        double occupancyRate = Math.min(1.0, (double) bookedNights / totalNights);

        // Revenue calculations
        BigDecimal totalRevenue = calculateTotalRevenue(reservations);
        BigDecimal adr = bookedNights > 0
            ? totalRevenue.divide(BigDecimal.valueOf(bookedNights), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        BigDecimal revPar = totalRevenue.divide(BigDecimal.valueOf(totalNights), 2, RoundingMode.HALF_UP);

        // Monthly breakdowns
        Map<String, Double> occupancyByMonth = calculateOccupancyByMonth(from, to, reservations);
        Map<String, BigDecimal> revenueByMonth = calculateRevenueByMonth(reservations);
        Map<String, Integer> bookingsBySource = calculateBookingsBySource(reservations);

        // Forecast for next 30 days after 'to'
        List<OccupancyForecastDto> forecast = getForecast(propertyId, to, to.plusDays(30), reservations);

        return new RevenueAnalyticsDto(
            propertyId, from, to, totalNights, bookedNights, occupancyRate,
            totalRevenue, adr, revPar,
            occupancyByMonth, revenueByMonth, bookingsBySource, forecast
        );
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
        Set<LocalDate> bookedDates = new HashSet<>();
        for (Reservation r : reservations) {
            if (r.getCheckIn() == null || r.getCheckOut() == null) continue;
            LocalDate start = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
            LocalDate end = r.getCheckOut().isAfter(to) ? to : r.getCheckOut();
            LocalDate d = start;
            while (d.isBefore(end)) {
                bookedDates.add(d);
                d = d.plusDays(1);
            }
        }
        return bookedDates.size();
    }

    BigDecimal calculateTotalRevenue(List<Reservation> reservations) {
        return reservations.stream()
            .map(r -> r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    Map<String, Double> calculateOccupancyByMonth(LocalDate from, LocalDate to,
                                                     List<Reservation> reservations) {
        Map<String, Integer> totalDaysByMonth = new LinkedHashMap<>();
        Map<String, Integer> bookedDaysByMonth = new LinkedHashMap<>();

        Set<LocalDate> bookedDates = new HashSet<>();
        for (Reservation r : reservations) {
            if (r.getCheckIn() == null || r.getCheckOut() == null) continue;
            LocalDate start = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
            LocalDate end = r.getCheckOut().isAfter(to) ? to : r.getCheckOut();
            LocalDate d = start;
            while (d.isBefore(end)) {
                bookedDates.add(d);
                d = d.plusDays(1);
            }
        }

        LocalDate d = from;
        while (d.isBefore(to)) {
            String monthKey = d.getMonth().getDisplayName(TextStyle.SHORT, Locale.FRENCH) + " " + d.getYear();
            totalDaysByMonth.merge(monthKey, 1, Integer::sum);
            if (bookedDates.contains(d)) {
                bookedDaysByMonth.merge(monthKey, 1, Integer::sum);
            }
            d = d.plusDays(1);
        }

        Map<String, Double> result = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : totalDaysByMonth.entrySet()) {
            int booked = bookedDaysByMonth.getOrDefault(entry.getKey(), 0);
            double rate = (double) booked / entry.getValue();
            result.put(entry.getKey(), Math.round(rate * 100.0) / 100.0);
        }
        return result;
    }

    Map<String, BigDecimal> calculateRevenueByMonth(List<Reservation> reservations) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (Reservation r : reservations) {
            if (r.getCheckIn() == null) continue;
            String monthKey = r.getCheckIn().getMonth().getDisplayName(TextStyle.SHORT, Locale.FRENCH)
                + " " + r.getCheckIn().getYear();
            BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            result.merge(monthKey, price, BigDecimal::add);
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
}
