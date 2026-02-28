package com.clenzy.service;

import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiAnalyticsServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @InjectMocks private AiAnalyticsService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private Property createProperty(BigDecimal nightlyPrice) {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setNightlyPrice(nightlyPrice);
        return p;
    }

    private Reservation createReservation(LocalDate checkIn, LocalDate checkOut,
                                           BigDecimal totalPrice, String source) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(totalPrice);
        r.setSource(source);
        return r;
    }

    // ---- getAnalytics ----

    @Test
    void getAnalytics_returnsCorrectOccupancy() {
        when(propertyRepository.findById(PROPERTY_ID))
            .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 11); // 10 nights

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4),
                new BigDecimal("300"), "airbnb"),
            createReservation(LocalDate.of(2026, 3, 6), LocalDate.of(2026, 3, 9),
                new BigDecimal("450"), "booking")
        );

        when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
            .thenReturn(reservations);

        RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

        assertEquals(PROPERTY_ID, result.propertyId());
        assertEquals(10, result.totalNights());
        assertEquals(6, result.bookedNights()); // 3 nights + 3 nights
        assertEquals(0.6, result.occupancyRate(), 0.01);
        assertEquals(0, new BigDecimal("750").compareTo(result.totalRevenue()));
    }

    @Test
    void getAnalytics_calculatesAdrAndRevpar() {
        when(propertyRepository.findById(PROPERTY_ID))
            .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 11); // 10 nights

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                new BigDecimal("500"), "airbnb")
        );

        when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
            .thenReturn(reservations);

        RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

        // ADR = 500 / 5 booked nights = 100
        assertEquals(new BigDecimal("100.00"), result.averageDailyRate());
        // RevPAR = 500 / 10 total nights = 50
        assertEquals(new BigDecimal("50.00"), result.revPar());
    }

    @Test
    void getAnalytics_propertyNotFound_throws() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
            () -> service.getAnalytics(PROPERTY_ID, ORG_ID, LocalDate.now(), LocalDate.now().plusDays(7)));
    }

    // ---- calculateBookedNights ----

    @Test
    void calculateBookedNights_noOverlap() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 3), null, null),
            createReservation(LocalDate.of(2026, 3, 5), LocalDate.of(2026, 3, 7), null, null)
        );

        int nights = service.calculateBookedNights(from, to, reservations);
        assertEquals(4, nights); // 2 + 2
    }

    @Test
    void calculateBookedNights_withOverlap() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), null, null),
            createReservation(LocalDate.of(2026, 3, 3), LocalDate.of(2026, 3, 7), null, null) // overlaps with first
        );

        int nights = service.calculateBookedNights(from, to, reservations);
        assertEquals(6, nights); // Mar 1-6 (set avoids duplicates)
    }

    @Test
    void calculateBookedNights_reservationExtendsBeyondRange() {
        LocalDate from = LocalDate.of(2026, 3, 5);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 15), null, null)
        );

        int nights = service.calculateBookedNights(from, to, reservations);
        assertEquals(5, nights); // Only Mar 5-9
    }

    // ---- calculateTotalRevenue ----

    @Test
    void calculateTotalRevenue_sumsCorrectly() {
        List<Reservation> reservations = List.of(
            createReservation(null, null, new BigDecimal("200"), null),
            createReservation(null, null, new BigDecimal("350"), null),
            createReservation(null, null, null, null) // null totalPrice
        );

        BigDecimal total = service.calculateTotalRevenue(reservations);
        assertEquals(0, new BigDecimal("550").compareTo(total));
    }

    // ---- calculateBookingsBySource ----

    @Test
    void calculateBookingsBySource_countsCorrectly() {
        List<Reservation> reservations = List.of(
            createReservation(null, null, null, "airbnb"),
            createReservation(null, null, null, "airbnb"),
            createReservation(null, null, null, "booking"),
            createReservation(null, null, null, null) // null source -> "other"
        );

        Map<String, Integer> result = service.calculateBookingsBySource(reservations);
        assertEquals(2, result.get("airbnb"));
        assertEquals(1, result.get("booking"));
        assertEquals(1, result.get("other"));
    }

    // ---- forecastForDate ----

    @Test
    void forecastForDate_alreadyBooked() {
        LocalDate date = LocalDate.of(2026, 7, 15);
        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 20), null, null)
        );

        OccupancyForecastDto forecast = service.forecastForDate(PROPERTY_ID, date, reservations);

        assertTrue(forecast.isBooked());
        assertEquals(1.0, forecast.predictedOccupancy());
        assertEquals(1.0, forecast.confidence());
        assertEquals("Already booked", forecast.reason());
    }

    @Test
    void forecastForDate_notBooked_highSeason() {
        // A date in July (HIGH season) that is not booked
        LocalDate date = LocalDate.of(2026, 7, 15);
        List<Reservation> reservations = List.of(); // no historical data

        OccupancyForecastDto forecast = service.forecastForDate(PROPERTY_ID, date, reservations);

        assertFalse(forecast.isBooked());
        assertEquals("HIGH", forecast.season());
        assertTrue(forecast.predictedOccupancy() > 0);
        assertTrue(forecast.reason().contains("High season"));
    }

    @Test
    void forecastForDate_notBooked_lowSeason() {
        LocalDate date = LocalDate.of(2026, 1, 15);
        List<Reservation> reservations = List.of();

        OccupancyForecastDto forecast = service.forecastForDate(PROPERTY_ID, date, reservations);

        assertFalse(forecast.isBooked());
        assertEquals("LOW", forecast.season());
        assertTrue(forecast.reason().contains("Low season"));
    }

    // ---- getSeason / getDayType ----

    @Test
    void getSeason_correctMapping() {
        assertEquals("HIGH", service.getSeason(LocalDate.of(2026, 7, 1)));
        assertEquals("HIGH", service.getSeason(LocalDate.of(2026, 8, 1)));
        assertEquals("LOW", service.getSeason(LocalDate.of(2026, 1, 1)));
        assertEquals("MID", service.getSeason(LocalDate.of(2026, 3, 1)));
        assertEquals("MID", service.getSeason(LocalDate.of(2026, 12, 1)));
    }

    @Test
    void getDayType_correctMapping() {
        // 2026-03-06 is a Friday
        assertEquals("WEEKEND", service.getDayType(LocalDate.of(2026, 3, 6)));
        // 2026-03-07 is a Saturday
        assertEquals("WEEKEND", service.getDayType(LocalDate.of(2026, 3, 7)));
        // 2026-03-09 is a Monday
        assertEquals("WEEKDAY", service.getDayType(LocalDate.of(2026, 3, 9)));
    }

    // ---- historicalFactor ----

    @Test
    void calculateHistoricalFactor_noData() {
        double factor = service.calculateHistoricalFactor(LocalDate.of(2026, 7, 15), List.of());
        assertEquals(1.0, factor);
    }

    @Test
    void calculateHistoricalFactor_withMatchingData() {
        LocalDate date = LocalDate.of(2026, 7, 15);
        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2025, 7, 10), LocalDate.of(2025, 7, 20), null, null),
            createReservation(LocalDate.of(2025, 7, 12), LocalDate.of(2025, 7, 18), null, null),
            createReservation(LocalDate.of(2025, 7, 5), LocalDate.of(2025, 7, 14), null, null)
        );

        double factor = service.calculateHistoricalFactor(date, reservations);
        assertTrue(factor >= 1.0, "With matching historical data, factor should be >= 1.0");
    }

    // ---- forecast confidence ----

    @Test
    void calculateForecastConfidence_moreDataAndCloserDateHigher() {
        List<Reservation> fewReservations = List.of(
            createReservation(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 5), null, null)
        );
        List<Reservation> manyReservations = List.of(
            createReservation(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 5), null, null),
            createReservation(LocalDate.of(2025, 6, 10), LocalDate.of(2025, 6, 15), null, null),
            createReservation(LocalDate.of(2025, 7, 1), LocalDate.of(2025, 7, 5), null, null),
            createReservation(LocalDate.of(2025, 7, 10), LocalDate.of(2025, 7, 15), null, null),
            createReservation(LocalDate.of(2025, 8, 1), LocalDate.of(2025, 8, 5), null, null),
            createReservation(LocalDate.of(2025, 8, 10), LocalDate.of(2025, 8, 15), null, null),
            createReservation(LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 5), null, null),
            createReservation(LocalDate.of(2025, 9, 10), LocalDate.of(2025, 9, 15), null, null),
            createReservation(LocalDate.of(2025, 10, 1), LocalDate.of(2025, 10, 5), null, null),
            createReservation(LocalDate.of(2025, 10, 10), LocalDate.of(2025, 10, 15), null, null),
            createReservation(LocalDate.of(2025, 11, 1), LocalDate.of(2025, 11, 5), null, null),
            createReservation(LocalDate.of(2025, 11, 10), LocalDate.of(2025, 11, 15), null, null),
            createReservation(LocalDate.of(2025, 12, 1), LocalDate.of(2025, 12, 5), null, null),
            createReservation(LocalDate.of(2025, 12, 10), LocalDate.of(2025, 12, 15), null, null),
            createReservation(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 5), null, null)
        );

        LocalDate nearDate = LocalDate.now().plusDays(3);

        double lowConfidence = service.calculateForecastConfidence(nearDate, fewReservations);
        double highConfidence = service.calculateForecastConfidence(nearDate, manyReservations);
        assertTrue(highConfidence > lowConfidence);
    }
}
