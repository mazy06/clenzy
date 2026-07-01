package com.clenzy.service.agent.analytics;

import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.service.AiAnalyticsService;
import com.clenzy.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DemandForecastService — prévision long terme agrégée par mois")
class DemandForecastServiceTest {

    private static final Long PROP = 5L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private AiAnalyticsService aiAnalyticsService;
    @Mock private ReservationService reservationService;

    private DemandForecastService service;

    @BeforeEach
    void setUp() {
        service = new DemandForecastService(aiAnalyticsService, reservationService, CLOCK);
        when(reservationService.getReservations(any(), any(), any(), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("Forecast jour/jour → agrégation par mois (moyennes, pic/creux)")
    void aggregatesByMonth() {
        List<OccupancyForecastDto> daily = List.of(
                day(LocalDate.of(2026, 7, 10), 0.8, true),
                day(LocalDate.of(2026, 7, 20), 0.6, false),
                day(LocalDate.of(2026, 8, 5), 0.2, false),
                day(LocalDate.of(2026, 8, 15), 0.4, false));
        when(aiAnalyticsService.getForecast(eq(PROP), any(), any(), any())).thenReturn(daily);

        DemandForecastService.LongTermForecastResult result = service.forecastLongTerm(PROP, 6, "kc");

        assertThat(result.monthly()).hasSize(2);
        assertThat(month(result, "2026-07").avgOccupancy()).isEqualTo(0.7);
        assertThat(month(result, "2026-07").bookedDays()).isEqualTo(1);
        assertThat(month(result, "2026-08").avgOccupancy()).isEqualTo(0.3);
        assertThat(result.overallAvgOccupancy()).isEqualTo(0.5);
        assertThat(result.headline()).contains("2026-07").contains("2026-08");
    }

    @Test
    @DisplayName("Forecast vide → résultat vide")
    void emptyForecast() {
        when(aiAnalyticsService.getForecast(eq(PROP), any(), any(), any())).thenReturn(List.of());

        DemandForecastService.LongTermForecastResult result = service.forecastLongTerm(PROP, 6, "kc");

        assertThat(result.monthly()).isEmpty();
        assertThat(result.headline()).contains("indisponible");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static DemandForecastService.MonthForecast month(
            DemandForecastService.LongTermForecastResult result, String ym) {
        return result.monthly().stream()
                .filter(mf -> mf.month().equals(ym))
                .findFirst()
                .orElseThrow();
    }

    private static OccupancyForecastDto day(LocalDate date, double occ, boolean booked) {
        return new OccupancyForecastDto(PROP, date, occ, 0.9, booked, "WEEKDAY", "HIGH", "r");
    }
}
