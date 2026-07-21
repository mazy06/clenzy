package com.clenzy.service;

import com.clenzy.dto.BookingCurveDto;
import com.clenzy.dto.PaceSummaryDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaceAnalyticsServiceTest {

    private static final Long ORG = 10L;
    /** « Aujourd'hui » figé : 2026-07-20 12:00 UTC. */
    private static final Instant NOW = Instant.parse("2026-07-20T12:00:00Z");
    private static final LocalDateTime NOW_LDT = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;

    private PaceAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new PaceAnalyticsService(reservationRepository, propertyRepository,
                Clock.fixed(NOW, ZoneId.of("UTC")));
    }

    private static Reservation reservation(LocalDate checkIn, LocalDate checkOut,
                                           BigDecimal totalPrice, LocalDateTime createdAt) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(totalPrice);
        r.setStatus("confirmed");
        r.setCreatedAt(createdAt);
        return r;
    }

    // ── Cœur activeAt / aggregateOtb ────────────────────────────────────────

    @Test
    void whenCancelledAfterSnapshot_thenStillCountedAtThatSnapshot() {
        Reservation r = reservation(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 15),
                new BigDecimal("500.00"), NOW_LDT.minusDays(30));
        r.setCancelledAt(NOW_LDT.minusDays(5));
        r.setStatus("cancelled");

        // Vue à J-10 (avant l'annulation) : la réservation était au livre.
        assertThat(PaceAnalyticsService.activeAt(r, NOW_LDT.minusDays(10))).isTrue();
        // Vue aujourd'hui (après l'annulation) : elle n'y est plus.
        assertThat(PaceAnalyticsService.activeAt(r, NOW_LDT)).isFalse();
    }

    @Test
    void whenCreatedAfterSnapshot_thenNotCounted() {
        Reservation r = reservation(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 15),
                new BigDecimal("500.00"), NOW_LDT.minusDays(2));

        assertThat(PaceAnalyticsService.activeAt(r, NOW_LDT.minusDays(7))).isFalse();
        assertThat(PaceAnalyticsService.activeAt(r, NOW_LDT)).isTrue();
    }

    @Test
    void whenCancelledWithoutTimestamp_thenNeverCounted() {
        // Garde-fou : ne devrait pas exister après le backfill 0349.
        Reservation r = reservation(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 15),
                new BigDecimal("500.00"), NOW_LDT.minusDays(30));
        r.setStatus("cancelled");

        assertThat(PaceAnalyticsService.activeAt(r, NOW_LDT.minusDays(10))).isFalse();
    }

    @Test
    void whenStayPartiallyOverlapsWindow_thenNightsAndRevenueProrated() {
        // 10 nuits (28 juil -> 7 août) à 1000 : 6 nuits dans août (1er au 6) => 600.00.
        Reservation r = reservation(LocalDate.of(2026, 7, 28), LocalDate.of(2026, 8, 7),
                new BigDecimal("1000.00"), NOW_LDT.minusDays(40));

        PaceAnalyticsService.Otb otb = PaceAnalyticsService.aggregateOtb(
                List.of(r), LocalDate.of(2026, 8, 1), LocalDate.of(2026, 9, 1), NOW_LDT);

        assertThat(otb.nights()).isEqualTo(6L);
        assertThat(otb.revenue()).isEqualByComparingTo("600.00");
    }

    // ── getSummary : pickup et occupation ───────────────────────────────────

    @Test
    void whenReservationCreatedThreeDaysAgo_thenAppearsInPickup7() {
        // Séjour d'août (5 nuits), réservé il y a 3 jours : OTB=5, pickup7=5, pickup28=5.
        Reservation recent = reservation(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 15),
                new BigDecimal("500.00"), NOW_LDT.minusDays(3));
        // Séjour d'août réservé il y a 60 jours : dans l'OTB mais pas dans le pickup.
        Reservation old = reservation(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 3),
                new BigDecimal("200.00"), NOW_LDT.minusDays(60));

        when(reservationRepository.findOverlappingWindowForPace(any(), any(), eq(ORG), isNull(), isNull()))
                .thenReturn(List.of(recent, old))   // fenêtre courante
                .thenReturn(List.of());             // fenêtre STLY
        when(propertyRepository.countForDashboardByStatus(ORG, null, PropertyStatus.ACTIVE))
                .thenReturn(2L);

        PaceSummaryDto summary = service.getSummary(ORG, null, 2, null);

        assertThat(summary.activeProperties()).isEqualTo(2L);
        assertThat(summary.months()).hasSize(2);
        var august = summary.months().get(1);
        assertThat(august.month()).isEqualTo("2026-08");
        assertThat(august.otbNights()).isEqualTo(7L);
        assertThat(august.pickup7Nights()).isEqualTo(5L);
        assertThat(august.pickup28Nights()).isEqualTo(5L);
        assertThat(august.stlyNights()).isZero();
        assertThat(august.paceVsStlyPct()).isNull(); // STLY = 0 -> pas de ratio
        // 7 nuits / (2 logements x 31 jours) = 11.3 %.
        assertThat(august.occupancyOtbPct()).isEqualTo(11.3);
    }

    @Test
    void whenBookingCurveRequested_thenPointsStopAtToday() {
        when(reservationRepository.findOverlappingWindowForPace(any(), any(), eq(ORG), isNull(), isNull()))
                .thenReturn(List.of())
                .thenReturn(List.of());

        // Mois futur (septembre) : dernier point = lead d'aujourd'hui, pas de point négatif.
        BookingCurveDto curve = service.getBookingCurve(ORG, null, YearMonth.of(2026, 9), null);

        assertThat(curve.month()).isEqualTo("2026-09");
        assertThat(curve.points()).isNotEmpty();
        int lastLead = curve.points().get(curve.points().size() - 1).daysBeforeMonthStart();
        assertThat(lastLead).isEqualTo(43); // 2026-07-20 -> 2026-09-01
        assertThat(curve.points())
                .allSatisfy(p -> assertThat(p.daysBeforeMonthStart()).isBetween(0, 180));
    }
}
