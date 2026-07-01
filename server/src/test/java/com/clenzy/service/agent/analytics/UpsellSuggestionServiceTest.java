package com.clenzy.service.agent.analytics;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.tenant.TenantContext;
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
@DisplayName("UpsellSuggestionService — opportunités d'upsell")
class UpsellSuggestionServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 5L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarEngine calendarEngine;
    @Mock private TenantContext tenantContext;

    private UpsellSuggestionService service;

    @BeforeEach
    void setUp() {
        service = new UpsellSuggestionService(reservationRepository, calendarEngine, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Nuits adjacentes libres → 2 upsells (veille + départ)")
    void bothAdjacentNightsFree_twoUpsells() {
        Reservation r = res(10L, LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 15));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of(r));
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of()); // tout libre

        UpsellSuggestionService.UpsellResult result = service.suggest(30);

        assertThat(result.suggestions()).hasSize(1);
        assertThat(result.suggestions().get(0).upsells()).hasSize(2);
        assertThat(result.suggestions().get(0).guestName()).isEqualTo("Jean");
    }

    @Test
    @DisplayName("Veille réservée → seul l'upsell de départ")
    void nightBeforeBooked_onlyDeparture() {
        Reservation r = res(10L, LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 15));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of(r));
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(List.of(day(LocalDate.of(2026, 7, 9), CalendarDayStatus.BOOKED)));

        UpsellSuggestionService.UpsellResult result = service.suggest(30);

        assertThat(result.suggestions()).hasSize(1);
        assertThat(result.suggestions().get(0).upsells()).hasSize(1);
        assertThat(result.suggestions().get(0).upsells().get(0)).contains("départ");
    }

    @Test
    @DisplayName("Nuits adjacentes réservées → aucune opportunité")
    void bothAdjacentNightsBooked_none() {
        Reservation r = res(10L, LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 15));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of(r));
        when(calendarEngine.getDays(eq(PROP), any(), any(), eq(ORG))).thenReturn(List.of(
                day(LocalDate.of(2026, 7, 9), CalendarDayStatus.BOOKED),
                day(LocalDate.of(2026, 7, 15), CalendarDayStatus.BOOKED)));

        UpsellSuggestionService.UpsellResult result = service.suggest(30);

        assertThat(result.suggestions()).isEmpty();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static Reservation res(Long id, LocalDate checkIn, LocalDate checkOut) {
        Property p = new Property();
        p.setId(PROP);
        p.setName("Villa A");
        Reservation r = new Reservation();
        r.setId(id);
        r.setProperty(p);
        r.setStatus("confirmed");
        r.setGuestName("Jean");
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        return r;
    }

    private static CalendarDay day(LocalDate date, CalendarDayStatus status) {
        CalendarDay d = new CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }
}
