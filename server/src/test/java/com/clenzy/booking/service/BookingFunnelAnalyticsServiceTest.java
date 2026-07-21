package com.clenzy.booking.service;

import com.clenzy.dto.FunnelAnalyticsDto;
import com.clenzy.repository.BookingFunnelEventRepository;
import com.clenzy.repository.BookingFunnelEventRepository.DeniedSearch;
import com.clenzy.repository.BookingFunnelEventRepository.TypeCount;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingFunnelAnalyticsServiceTest {

    private static final Long ORG = 10L;

    @Mock private BookingFunnelEventRepository funnelRepository;
    @Mock private ReservationRepository reservationRepository;

    private BookingFunnelAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new BookingFunnelAnalyticsService(funnelRepository, reservationRepository);
    }

    private static TypeCount typeCount(String type, long count) {
        return new TypeCount() {
            @Override public String getEventType() { return type; }
            @Override public long getCount() { return count; }
        };
    }

    private static DeniedSearch denied(String checkIn, String checkOut, long count) {
        return new DeniedSearch() {
            @Override public String getCheckIn() { return checkIn; }
            @Override public String getCheckOut() { return checkOut; }
            @Override public String getGuests() { return "2"; }
            @Override public long getCount() { return count; }
        };
    }

    @Test
    void whenEventsExist_thenRatesComputedOverAllSearches() {
        // 80 recherches avec dispo + 20 sans = 100 recherches ; 10 résas directes.
        when(funnelRepository.countByTypeBetween(eq(ORG), any(), any())).thenReturn(List.of(
                typeCount("SEARCH", 80),
                typeCount("SEARCH_NO_RESULT", 20),
                typeCount("VIEW_PROPERTY", 50),
                typeCount("CHECKOUT_START", 15)));
        when(reservationRepository.countDirectCreatedBetween(eq(ORG), any(), any())).thenReturn(10L);
        when(funnelRepository.countDailyByTypeBetween(eq(ORG), any(), any())).thenReturn(List.of());
        when(funnelRepository.topDeniedSearches(eq(ORG), any(), any(), anyInt()))
                .thenReturn(List.of(denied("2026-08-10", "2026-08-15", 7)));

        FunnelAnalyticsDto dto = service.getAnalytics(ORG,
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));

        assertThat(dto.searches()).isEqualTo(100L);
        assertThat(dto.deniedSearches()).isEqualTo(20L);
        assertThat(dto.deniedPct()).isEqualTo(20.0);
        assertThat(dto.conversionPct()).isEqualTo(10.0);
        assertThat(dto.checkoutStarts()).isEqualTo(15L);
        assertThat(dto.topDenied()).hasSize(1);
        assertThat(dto.topDenied().get(0).count()).isEqualTo(7L);
    }

    @Test
    void whenNoSearches_thenRatesAreNullNotZeroDivision() {
        when(funnelRepository.countByTypeBetween(eq(ORG), any(), any())).thenReturn(List.of());
        when(reservationRepository.countDirectCreatedBetween(eq(ORG), any(), any())).thenReturn(0L);
        when(funnelRepository.countDailyByTypeBetween(eq(ORG), any(), any())).thenReturn(List.of());
        when(funnelRepository.topDeniedSearches(eq(ORG), any(), any(), anyInt())).thenReturn(List.of());

        FunnelAnalyticsDto dto = service.getAnalytics(ORG,
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));

        assertThat(dto.conversionPct()).isNull();
        assertThat(dto.deniedPct()).isNull();
    }
}
