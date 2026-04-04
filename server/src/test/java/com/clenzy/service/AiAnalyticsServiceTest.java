package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.dto.AiInsightDto;
import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.exception.AiBudgetExceededException;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiAnalyticsServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private AiProperties aiProperties;
    @Mock private AiProviderRouter aiProviderRouter;
    @Mock private AiAnonymizationService anonymizationService;
    @Mock private AiTokenBudgetService tokenBudgetService;
    @Spy  private ObjectMapper objectMapper = new ObjectMapper();
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

    // ─── Rule-based: getAnalytics ─────────────────────────────────────

    @Nested
    class GetAnalytics {

        @Test
        void returnsCorrectOccupancy() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 11);

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
            assertEquals(6, result.bookedNights());
            assertEquals(0.6, result.occupancyRate(), 0.01);
            assertEquals(0, new BigDecimal("750").compareTo(result.totalRevenue()));
        }

        @Test
        void calculatesAdrAndRevpar() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 11);

            List<Reservation> reservations = List.of(
                createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                    new BigDecimal("500"), "airbnb")
            );

            when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
                .thenReturn(reservations);

            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            assertEquals(new BigDecimal("100.00"), result.averageDailyRate());
            assertEquals(new BigDecimal("50.00"), result.revPar());
        }

        @Test
        void propertyNotFound_throws() {
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            assertThrows(IllegalArgumentException.class,
                () -> service.getAnalytics(PROPERTY_ID, ORG_ID, LocalDate.now(), LocalDate.now().plusDays(7)));
        }
    }

    // ─── Rule-based: calculateBookedNights ────────────────────────────

    @Test
    void calculateBookedNights_noOverlap() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 3), null, null),
            createReservation(LocalDate.of(2026, 3, 5), LocalDate.of(2026, 3, 7), null, null)
        );

        assertEquals(4, service.calculateBookedNights(from, to, reservations));
    }

    @Test
    void calculateBookedNights_withOverlap() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), null, null),
            createReservation(LocalDate.of(2026, 3, 3), LocalDate.of(2026, 3, 7), null, null)
        );

        assertEquals(6, service.calculateBookedNights(from, to, reservations));
    }

    @Test
    void calculateBookedNights_reservationExtendsBeyondRange() {
        LocalDate from = LocalDate.of(2026, 3, 5);
        LocalDate to = LocalDate.of(2026, 3, 10);

        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 15), null, null)
        );

        assertEquals(5, service.calculateBookedNights(from, to, reservations));
    }

    // ─── Rule-based: calculateTotalRevenue ────────────────────────────

    @Test
    void calculateTotalRevenue_sumsCorrectly() {
        List<Reservation> reservations = List.of(
            createReservation(null, null, new BigDecimal("200"), null),
            createReservation(null, null, new BigDecimal("350"), null),
            createReservation(null, null, null, null)
        );

        BigDecimal total = service.calculateTotalRevenue(reservations);
        assertEquals(0, new BigDecimal("550").compareTo(total));
    }

    // ─── Rule-based: calculateBookingsBySource ────────────────────────

    @Test
    void calculateBookingsBySource_countsCorrectly() {
        List<Reservation> reservations = List.of(
            createReservation(null, null, null, "airbnb"),
            createReservation(null, null, null, "airbnb"),
            createReservation(null, null, null, "booking"),
            createReservation(null, null, null, null)
        );

        Map<String, Integer> result = service.calculateBookingsBySource(reservations);
        assertEquals(2, result.get("airbnb"));
        assertEquals(1, result.get("booking"));
        assertEquals(1, result.get("other"));
    }

    // ─── Rule-based: forecastForDate ──────────────────────────────────

    @Nested
    class ForecastForDate {

        @Test
        void alreadyBooked() {
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
        void notBooked_highSeason() {
            LocalDate date = LocalDate.of(2026, 7, 15);
            List<Reservation> reservations = List.of();

            OccupancyForecastDto forecast = service.forecastForDate(PROPERTY_ID, date, reservations);

            assertFalse(forecast.isBooked());
            assertEquals("HIGH", forecast.season());
            assertTrue(forecast.predictedOccupancy() > 0);
            assertTrue(forecast.reason().contains("High season"));
        }

        @Test
        void notBooked_lowSeason() {
            LocalDate date = LocalDate.of(2026, 1, 15);
            List<Reservation> reservations = List.of();

            OccupancyForecastDto forecast = service.forecastForDate(PROPERTY_ID, date, reservations);

            assertFalse(forecast.isBooked());
            assertEquals("LOW", forecast.season());
            assertTrue(forecast.reason().contains("Low season"));
        }
    }

    // ─── Rule-based: season / dayType / historicalFactor ──────────────

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
        assertEquals("WEEKEND", service.getDayType(LocalDate.of(2026, 3, 6)));
        assertEquals("WEEKEND", service.getDayType(LocalDate.of(2026, 3, 7)));
        assertEquals("WEEKDAY", service.getDayType(LocalDate.of(2026, 3, 9)));
    }

    @Test
    void calculateHistoricalFactor_noData() {
        assertEquals(1.0, service.calculateHistoricalFactor(LocalDate.of(2026, 7, 15), List.of()));
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

    // ─── AI-powered ───────────────────────────────────────────────────

    @Nested
    class AiPowered {

        private static final ResolvedKey PLATFORM_KEY = new ResolvedKey("sk-platform", null, KeySource.PLATFORM);

        private void enableAnalyticsAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setAnalyticsAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        private void disableAnalyticsAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setAnalyticsAi(false);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        private void setupPropertyAndReservations() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

            List<Reservation> reservations = List.of(
                createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4),
                    new BigDecimal("300"), "airbnb")
            );

            when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
                .thenReturn(reservations);
        }

        @Test
        void featureFlagDisabled_throws() {
            disableAnalyticsAi();

            assertThrows(AiNotConfiguredException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31)));
        }

        @Test
        void validResponse_parsesCorrectly() {
            enableAnalyticsAi();
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            setupPropertyAndReservations();
            when(anonymizationService.anonymize(any())).thenAnswer(inv -> inv.getArgument(0));
            AiResponse aiResponse = new AiResponse(
                """
                [
                  {"type":"TREND","severity":"MEDIUM","title":"Low weekday occupancy","description":"Weekday occupancy drops below 40%.","recommendation":"Consider dynamic weekday pricing."},
                  {"type":"RECOMMENDATION","severity":"HIGH","title":"Increase weekend rates","description":"Weekend demand exceeds supply.","recommendation":"Raise weekend rates by 15%."}
                ]
                """,
                100, 150, 250, "claude-3-haiku", "end_turn"
            );
            when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.ANALYTICS), any(AiRequest.class)))
                .thenReturn(new RoutedResponse(aiResponse, "anthropic", KeySource.PLATFORM));

            List<AiInsightDto> insights = service.getAiInsights(
                PROPERTY_ID, ORG_ID, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10));

            assertEquals(2, insights.size());
            assertEquals("TREND", insights.get(0).type());
            assertEquals("MEDIUM", insights.get(0).severity());
            assertEquals("RECOMMENDATION", insights.get(1).type());
        }

        @Test
        void budgetExceeded_throws() {
            enableAnalyticsAi();
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            doThrow(new AiBudgetExceededException("ANALYTICS", 100_000, 100_000))
                .when(tokenBudgetService).requireBudget(ORG_ID, AiFeature.ANALYTICS, KeySource.PLATFORM);

            assertThrows(AiBudgetExceededException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31)));
        }

        @Test
        void recordsUsage() {
            enableAnalyticsAi();
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            setupPropertyAndReservations();
            when(anonymizationService.anonymize(any())).thenAnswer(inv -> inv.getArgument(0));
            AiResponse response = new AiResponse(
                """
                [{"type":"WARNING","severity":"LOW","title":"Test","description":"Desc","recommendation":"Rec"}]
                """,
                50, 80, 130, "claude-3-haiku", "end_turn"
            );
            when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.ANALYTICS), any(AiRequest.class)))
                .thenReturn(new RoutedResponse(response, "anthropic", KeySource.PLATFORM));

            service.getAiInsights(PROPERTY_ID, ORG_ID,
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10));

            verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.ANALYTICS), eq("anthropic"), eq(response));
        }

        @Test
        void invalidJson_throwsProviderException() {
            enableAnalyticsAi();
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            setupPropertyAndReservations();
            when(anonymizationService.anonymize(any())).thenAnswer(inv -> inv.getArgument(0));
            AiResponse aiResponse = new AiResponse("not valid json", 20, 10, 30, "claude-3-haiku", "end_turn");
            when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.ANALYTICS), any(AiRequest.class)))
                .thenReturn(new RoutedResponse(aiResponse, "anthropic", KeySource.PLATFORM));

            assertThrows(AiProviderException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10)));
        }
    }
}
