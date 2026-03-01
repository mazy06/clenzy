package com.clenzy.service;

import com.clenzy.dto.PricePredictionDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPricingServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @InjectMocks private AiPricingService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private Property createProperty(BigDecimal nightlyPrice) {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setNightlyPrice(nightlyPrice);
        return p;
    }

    private Reservation createReservation(LocalDate checkIn, LocalDate checkOut) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        return r;
    }

    @Test
    void getPredictions_returnsCorrectNumberOfDays() {
        when(propertyRepository.findById(PROPERTY_ID))
            .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));
        when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());

        LocalDate from = LocalDate.of(2025, 6, 1);
        LocalDate to = LocalDate.of(2025, 6, 7);

        List<PricePredictionDto> predictions = service.getPredictions(PROPERTY_ID, ORG_ID, from, to);

        assertEquals(7, predictions.size());
    }

    @Test
    void predictForDate_weekendPremium() {
        BigDecimal basePrice = new BigDecimal("100");
        // Saturday far in the future to avoid last-minute logic
        LocalDate saturday = LocalDate.now().plusDays(60);
        while (saturday.getDayOfWeek() != java.time.DayOfWeek.SATURDAY) {
            saturday = saturday.plusDays(1);
        }

        // Provide enough reservations to avoid low-demand discount
        List<Reservation> reservations = List.of(
            createReservation(saturday.minusDays(5), saturday.plusDays(2)),
            createReservation(saturday.minusDays(10), saturday.minusDays(3)),
            createReservation(saturday.minusDays(7), saturday.plusDays(1))
        );

        PricePredictionDto result = service.predictForDate(
            PROPERTY_ID, saturday, basePrice, reservations, ORG_ID);

        assertTrue(result.suggestedPrice().compareTo(basePrice) > 0);
        assertTrue(result.reason().contains("weekend"));
    }

    @Test
    void predictForDate_normalDemand() {
        BigDecimal basePrice = new BigDecimal("100");
        // Wednesday far in the future to avoid last-minute
        LocalDate wednesday = LocalDate.now().plusDays(60);
        while (wednesday.getDayOfWeek() != java.time.DayOfWeek.WEDNESDAY) {
            wednesday = wednesday.plusDays(1);
        }

        // Provide moderate reservations (not too many, not too few)
        List<Reservation> reservations = List.of(
            createReservation(wednesday.minusDays(5), wednesday.plusDays(2)),
            createReservation(wednesday.minusDays(10), wednesday.minusDays(3))
        );

        PricePredictionDto result = service.predictForDate(
            PROPERTY_ID, wednesday, basePrice, reservations, ORG_ID);

        assertEquals("Normal demand", result.reason());
    }

    @Test
    void calculateDemandScore_noData() {
        double score = service.calculateDemandScore(LocalDate.now(), List.of());
        assertEquals(0.0, score);
    }

    @Test
    void calculateDemandScore_withData() {
        LocalDate target = LocalDate.of(2025, 6, 15);
        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2025, 6, 10), LocalDate.of(2025, 6, 20)),
            createReservation(LocalDate.of(2025, 6, 12), LocalDate.of(2025, 6, 18)),
            createReservation(LocalDate.of(2025, 6, 14), LocalDate.of(2025, 6, 16))
        );

        double score = service.calculateDemandScore(target, reservations);
        assertTrue(score > 0);
        assertTrue(score <= 1.0);
    }

    @Test
    void calculateConfidence_moreDataHigherConfidence() {
        double lowData = service.calculateConfidence(2, 14);
        double highData = service.calculateConfidence(30, 14);
        assertTrue(highData > lowData);
    }

    @Test
    void getPredictions_propertyNotFound_throws() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
            () -> service.getPredictions(PROPERTY_ID, ORG_ID, LocalDate.now(), LocalDate.now().plusDays(7)));
    }
}
