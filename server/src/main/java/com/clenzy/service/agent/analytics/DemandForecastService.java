package com.clenzy.service.agent.analytics;

import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.model.Reservation;
import com.clenzy.service.AiAnalyticsService;
import com.clenzy.service.ReservationService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Prévision de demande LONG TERME, agrégée par mois (P1-7) — agent {@code rev}.
 *
 * <p>{@code get_occupancy_forecast} donne une prévision jour/jour (≤ 90 j), peu
 * lisible au-delà. Ce service projette sur plusieurs mois et <b>agrège par mois</b>
 * (occupation moyenne, confiance moyenne, jours déjà réservés, saison dominante)
 * → vue planification (capacité, staffing, trésorerie). S'appuie sur le modèle de
 * forecast existant ({@link AiAnalyticsService#getForecast}). Read-only.</p>
 */
@Service
public class DemandForecastService {

    private static final int HISTORY_MONTHS = 12;

    private final AiAnalyticsService aiAnalyticsService;
    private final ReservationService reservationService;
    private final Clock clock;

    public DemandForecastService(AiAnalyticsService aiAnalyticsService,
                                 ReservationService reservationService,
                                 Clock clock) {
        this.aiAnalyticsService = aiAnalyticsService;
        this.reservationService = reservationService;
        this.clock = clock;
    }

    public record MonthForecast(String month, double avgOccupancy, double avgConfidence,
                                int bookedDays, int days, String season) {}

    public record LongTermForecastResult(Long propertyId, int months,
                                         double overallAvgOccupancy,
                                         List<MonthForecast> monthly, String headline) {}

    /** Prévision agrégée par mois sur {@code months} mois (borné 2..12). */
    public LongTermForecastResult forecastLongTerm(Long propertyId, int months, String keycloakId) {
        LocalDate today = LocalDate.now(clock);
        int m = Math.max(2, Math.min(months, 12));
        LocalDate forecastTo = today.plusMonths(m);
        LocalDate historyFrom = today.minusMonths(HISTORY_MONTHS);

        List<Reservation> historical = reservationService.getReservations(
                keycloakId, List.of(propertyId), historyFrom, today);
        List<OccupancyForecastDto> forecast = aiAnalyticsService.getForecast(
                propertyId, today, forecastTo, historical);

        Map<YearMonth, MonthAcc> byMonth = new TreeMap<>();
        double occSumTotal = 0;
        int daysTotal = 0;
        for (OccupancyForecastDto f : forecast) {
            if (f.date() == null) {
                continue;
            }
            MonthAcc acc = byMonth.computeIfAbsent(YearMonth.from(f.date()), k -> new MonthAcc());
            acc.occSum += f.predictedOccupancy();
            acc.confSum += f.confidence();
            acc.days++;
            if (f.isBooked()) {
                acc.booked++;
            }
            if (f.season() != null) {
                acc.seasonCounts.merge(f.season(), 1, Integer::sum);
            }
            occSumTotal += f.predictedOccupancy();
            daysTotal++;
        }

        List<MonthForecast> monthly = new ArrayList<>();
        for (Map.Entry<YearMonth, MonthAcc> e : byMonth.entrySet()) {
            MonthAcc a = e.getValue();
            if (a.days == 0) {
                continue;
            }
            monthly.add(new MonthForecast(
                    e.getKey().toString(),
                    round2(a.occSum / a.days),
                    round2(a.confSum / a.days),
                    a.booked, a.days, dominantSeason(a.seasonCounts)));
        }

        double overall = daysTotal > 0 ? round2(occSumTotal / daysTotal) : 0.0;
        return new LongTermForecastResult(propertyId, m, overall, monthly, headline(monthly, overall));
    }

    private static String headline(List<MonthForecast> monthly, double overall) {
        if (monthly.isEmpty()) {
            return "Prévision indisponible.";
        }
        MonthForecast peak = monthly.stream()
                .max((a, b) -> Double.compare(a.avgOccupancy(), b.avgOccupancy())).orElse(null);
        MonthForecast low = monthly.stream()
                .min((a, b) -> Double.compare(a.avgOccupancy(), b.avgOccupancy())).orElse(null);
        StringBuilder sb = new StringBuilder("Occupation moyenne projetée " + Math.round(overall * 100) + "%.");
        if (peak != null) {
            sb.append(" Pic : ").append(peak.month())
                    .append(" (").append(Math.round(peak.avgOccupancy() * 100)).append("%).");
        }
        if (low != null && !low.month().equals(peak != null ? peak.month() : null)) {
            sb.append(" Creux : ").append(low.month())
                    .append(" (").append(Math.round(low.avgOccupancy() * 100)).append("%) — à dynamiser.");
        }
        return sb.toString();
    }

    private static String dominantSeason(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("MID");
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static final class MonthAcc {
        double occSum;
        double confSum;
        int days;
        int booked;
        final Map<String, Integer> seasonCounts = new HashMap<>();
    }
}
