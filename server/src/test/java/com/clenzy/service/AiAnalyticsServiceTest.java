package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.dto.AiInsightDto;
import com.clenzy.dto.OccupancyForecastDto;
import com.clenzy.dto.PeriodComparisonDto;
import com.clenzy.dto.RevenueAnalyticsDto;
import com.clenzy.exception.AiBudgetExceededException;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.service.KeySource;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
    @Mock private CurrencyConverterService currencyConverter;
    @Mock private CalendarDayRepository calendarDayRepository;
    // Garde réel (fail-closed) : un TenantContext mocké n'est ni super-admin ni org SYSTEM.
    @Spy  private OrganizationAccessGuard organizationAccessGuard =
        new OrganizationAccessGuard(mock(TenantContext.class));
    @InjectMocks private AiAnalyticsService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private Property createProperty(BigDecimal nightlyPrice) {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setOrganizationId(ORG_ID);
        p.setNightlyPrice(nightlyPrice);
        return p;
    }

    private CalendarDay blockedDay(LocalDate date) {
        return new CalendarDay(null, date, CalendarDayStatus.BLOCKED, ORG_ID);
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

        @Test
        void computesYearOverYearComparisonServerSide() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 11);
            LocalDate prevFrom = from.minusYears(1);
            LocalDate prevTo = to.minusYears(1);

            // Periode courante : 750 de revenu
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), eq(from), eq(to), eq(ORG_ID)))
                .thenReturn(List.of(
                    createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4), new BigDecimal("300"), "airbnb"),
                    createReservation(LocalDate.of(2026, 3, 6), LocalDate.of(2026, 3, 9), new BigDecimal("450"), "booking")));
            // Periode N-1 : 500 de revenu
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), eq(prevFrom), eq(prevTo), eq(ORG_ID)))
                .thenReturn(List.of(
                    createReservation(LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 6), new BigDecimal("500"), "airbnb")));

            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            PeriodComparisonDto cmp = result.comparison();
            assertNotNull(cmp);
            assertEquals("YEAR_OVER_YEAR", cmp.basis());
            assertEquals(prevFrom, cmp.previousFrom());
            assertEquals(0, new BigDecimal("750").compareTo(cmp.revenue().current()));
            assertEquals(0, new BigDecimal("500").compareTo(cmp.revenue().previous()));
            // delta = (750-500)/500*100 = 50.00
            assertEquals(0, new BigDecimal("50.00").compareTo(cmp.revenue().growthPct()));
        }

        @Test
        void consolidatesMultiCurrencyRevenueToReportingCurrency() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));

            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 11);

            Reservation eur = createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4),
                new BigDecimal("300"), "airbnb");
            eur.setCurrency("EUR");
            Reservation mad = createReservation(LocalDate.of(2026, 3, 5), LocalDate.of(2026, 3, 8),
                new BigDecimal("1000"), "booking");
            mad.setCurrency("MAD");

            when(reservationRepository.findByPropertyIdsAndDateRange(any(), eq(from), eq(to), eq(ORG_ID)))
                .thenReturn(List.of(eur, mad));
            when(reservationRepository.findByPropertyIdsAndDateRange(
                    any(), eq(from.minusYears(1)), eq(to.minusYears(1)), eq(ORG_ID)))
                .thenReturn(List.of());
            // MAD -> EUR a la date de la reservation MAD ; l'EUR ne passe pas par le converter (identite).
            when(currencyConverter.convert(eq(new BigDecimal("1000")), eq("MAD"), eq("EUR"), any()))
                .thenReturn(new BigDecimal("100.00"));

            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to, "EUR");

            assertEquals("EUR", result.reportingCurrency());
            // 300 (EUR, identite) + 100 (MAD->EUR) = 400
            assertEquals(0, new BigDecimal("400.00").compareTo(result.totalRevenue()));
        }
    }

    // ─── Définitions métier standard (Baitly Académie ép. 01) ─────────

    @Nested
    class StandardKpiDefinitions {

        private final LocalDate from = LocalDate.of(2026, 3, 1);
        private final LocalDate to = LocalDate.of(2026, 3, 11); // 10 nuits calendaires

        private void givenProperty() {
            when(propertyRepository.findById(PROPERTY_ID))
                .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));
        }

        private void givenReservations(Reservation... reservations) {
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
                .thenReturn(List.of(reservations));
        }

        private void givenClosedDays(LocalDate periodFrom, LocalDate periodTo, CalendarDay... days) {
            when(calendarDayRepository.findBlockedOrMaintenanceForProperties(
                    List.of(PROPERTY_ID), periodFrom, periodTo, ORG_ID))
                .thenReturn(List.of(days));
        }

        // ── 1. Nuits disponibles = nuits proposées à la vente ──

        @Test
        void whenOwnerBlocksNights_thenOccupancyAndRevParUseNightsOpenForSale() {
            // Arrange : 10 nuits, 4 bloquées (usage perso) → 6 nuits en vente, 3 vendues
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4),
                new BigDecimal("300"), "airbnb"));
            givenClosedDays(from, to,
                blockedDay(LocalDate.of(2026, 3, 7)), blockedDay(LocalDate.of(2026, 3, 8)),
                blockedDay(LocalDate.of(2026, 3, 9)), blockedDay(LocalDate.of(2026, 3, 10)));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert : occupation 3/6, RevPAR 300/6
            assertEquals(10, result.totalNights());
            assertEquals(6, result.availableNights());
            assertEquals(0.5, result.occupancyRate(), 0.0001);
            assertEquals(0, new BigDecimal("50.00").compareTo(result.revPar()));
            assertEquals(0, new BigDecimal("100.00").compareTo(result.averageDailyRate()));
        }

        @Test
        void whenBlockedDayCarriesAStay_thenTheSoldNightStaysAvailable() {
            // Arrange : blocage en conflit avec un séjour (import OTA) — la nuit vendue était en vente
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 3),
                new BigDecimal("200"), "airbnb"));
            givenClosedDays(from, to, blockedDay(LocalDate.of(2026, 3, 2)));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert : aucune nuit retirée, occupation 2/10 (jamais > 100 %)
            assertEquals(10, result.availableNights());
            assertEquals(0.2, result.occupancyRate(), 0.0001);
        }

        @Test
        void whenMonthHasBlockedNights_thenMonthlyOccupancyUsesNightsOpenForSale() {
            // Arrange : 10 nuits de mars, 5 bloquées, 5 vendues
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                new BigDecimal("500"), "airbnb"));
            givenClosedDays(from, to,
                blockedDay(LocalDate.of(2026, 3, 6)), blockedDay(LocalDate.of(2026, 3, 7)),
                blockedDay(LocalDate.of(2026, 3, 8)), blockedDay(LocalDate.of(2026, 3, 9)),
                blockedDay(LocalDate.of(2026, 3, 10)));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(1.0, result.occupancyByMonth().get(monthKey(from)), 0.0001);
        }

        // ── 2. Chiffre d'affaires = hébergement seul ──

        @Test
        void whenTotalPriceIncludesCleaningAndTouristTax_thenRevenueKpisUseAccommodationOnly() {
            // Arrange : 5 nuits, total 620 = 500 hébergement + 80 ménage + 40 taxe de séjour
            givenProperty();
            Reservation stay = createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                new BigDecimal("620"), "direct");
            stay.setCleaningFee(new BigDecimal("80"));
            stay.setTouristTaxAmount(new BigDecimal("40"));
            givenReservations(stay);

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(0, new BigDecimal("500").compareTo(result.totalRevenue()));
            assertEquals(0, new BigDecimal("100.00").compareTo(result.averageDailyRate()));
            assertEquals(0, new BigDecimal("50.00").compareTo(result.revPar()));
        }

        @Test
        void whenTotalPriceIncludesServiceOptions_thenOptionsAreExcludedFromRevenue() {
            // Arrange : 5 nuits, total 560 = 500 hébergement + 60 d'options (checkout booking engine)
            givenProperty();
            Reservation stay = createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                new BigDecimal("560"), "direct");
            stay.setServiceOptionsTotal(new BigDecimal("60"));
            givenReservations(stay);

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(0, new BigDecimal("500").compareTo(result.totalRevenue()));
        }

        // ── 3. Séjours à cheval : revenu proratisé par nuit ──

        @Test
        void whenStaySpansPeriodEnd_thenRevenueIsProratedPerNight() {
            // Arrange : 7 nuits à 1000 du 8 au 15 mars, 3 dans la période (8, 9, 10)
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 3, 8), LocalDate.of(2026, 3, 15),
                new BigDecimal("1000"), "booking"));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert : 1000 × 3/7 = 428.571… → 428.57 (HALF_UP)
            assertEquals(3, result.bookedNights());
            assertEquals(0, new BigDecimal("428.57").compareTo(result.totalRevenue()));
            assertEquals(0, new BigDecimal("142.86").compareTo(result.averageDailyRate()));
        }

        @Test
        void whenStayStartsBeforePeriod_thenRevenueIsProratedPerNight() {
            // Arrange : 6 nuits à 600 du 25 février au 3 mars, 2 dans la période
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 2, 25), LocalDate.of(2026, 3, 3),
                new BigDecimal("600"), "airbnb"));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(0, new BigDecimal("200").compareTo(result.totalRevenue()));
        }

        @Test
        void whenStayChecksOutOnPeriodStart_thenItBringsNoRevenue() {
            // Arrange : départ le 1er mars — aucune nuit dans la période
            givenProperty();
            givenReservations(createReservation(LocalDate.of(2026, 2, 25), LocalDate.of(2026, 3, 1),
                new BigDecimal("400"), "airbnb"));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(0, BigDecimal.ZERO.compareTo(result.totalRevenue()));
        }

        @Test
        void whenStaySpansTwoMonths_thenMonthlyRevenueSplitsByNight() {
            // Arrange : 5 nuits à 500 du 29 mars au 3 avril → 3 nuits en mars, 2 en avril
            givenProperty();
            LocalDate twoMonthsTo = LocalDate.of(2026, 5, 1);
            givenReservations(createReservation(LocalDate.of(2026, 3, 29), LocalDate.of(2026, 4, 3),
                new BigDecimal("500"), "airbnb"));

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, twoMonthsTo);

            // Assert
            assertEquals(0, new BigDecimal("300").compareTo(result.revenueByMonth().get(monthKey(from))));
            assertEquals(0, new BigDecimal("200").compareTo(
                result.revenueByMonth().get(monthKey(LocalDate.of(2026, 4, 1)))));
        }

        // ── Annulations ──

        @Test
        void whenReservationIsCancelled_thenItCountsNeitherNightsNorRevenue() {
            // Arrange
            givenProperty();
            Reservation cancelled = createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 6),
                new BigDecimal("500"), "booking");
            cancelled.markCancelled();
            givenReservations(cancelled);

            // Act
            RevenueAnalyticsDto result = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to);

            // Assert
            assertEquals(0, result.bookedNights());
            assertEquals(0, BigDecimal.ZERO.compareTo(result.totalRevenue()));
        }

        // ── N-1 : mêmes définitions ──

        @Test
        void whenPreviousYearHasBlocksFeesAndSpanningStay_thenComparisonUsesSameDefinitions() {
            // Arrange : N-1 = 1er-11 mars 2025, 1 nuit bloquée → 9 en vente ;
            // séjour 8-15 mars 2025 (7 nuits), total 800 dont 100 de ménage → 700 hébergement, 3 nuits dans la période
            givenProperty();
            LocalDate prevFrom = from.minusYears(1);
            LocalDate prevTo = to.minusYears(1);
            Reservation prevStay = createReservation(LocalDate.of(2025, 3, 8), LocalDate.of(2025, 3, 15),
                new BigDecimal("800"), "airbnb");
            prevStay.setCleaningFee(new BigDecimal("100"));
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), eq(from), eq(to), eq(ORG_ID)))
                .thenReturn(List.of());
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), eq(prevFrom), eq(prevTo), eq(ORG_ID)))
                .thenReturn(List.of(prevStay));
            givenClosedDays(from, to);
            givenClosedDays(prevFrom, prevTo, blockedDay(LocalDate.of(2025, 3, 1)));

            // Act
            PeriodComparisonDto cmp = service.getAnalytics(PROPERTY_ID, ORG_ID, from, to).comparison();

            // Assert : 700 × 3/7 = 300 ; ADR 300/3 ; RevPAR 300/9 ; occupation 3/9
            assertEquals(0, new BigDecimal("300.00").compareTo(cmp.revenue().previous()));
            assertEquals(0, new BigDecimal("100.00").compareTo(cmp.averageDailyRate().previous()));
            assertEquals(0, new BigDecimal("33.33").compareTo(cmp.revPar().previous()));
            assertEquals(1.0 / 3, cmp.occupancy().previous().doubleValue(), 0.0001);
        }

        // ── Isolation d'organisation ──

        @Test
        void whenPropertyBelongsToAnotherOrganization_thenAccessIsDenied() {
            // Arrange
            Property foreign = createProperty(new BigDecimal("100"));
            foreign.setOrganizationId(99L);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(foreign));

            // Act + Assert
            assertThrows(AccessDeniedException.class,
                () -> service.getAnalytics(PROPERTY_ID, ORG_ID, from, to));
        }
    }

    private static String monthKey(LocalDate date) {
        return date.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.FRENCH)
            + " " + date.getYear();
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
    void calculateTotalRevenue_sumsStaysAndTreatsMissingPriceAsZero() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 11);
        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 3), new BigDecimal("200"), null),
            createReservation(LocalDate.of(2026, 3, 3), LocalDate.of(2026, 3, 5), new BigDecimal("350"), null),
            createReservation(LocalDate.of(2026, 3, 5), LocalDate.of(2026, 3, 6), null, null)
        );

        BigDecimal total = service.calculateTotalRevenue(reservations, from, to, "EUR");
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

        private static final ResolvedTarget PLATFORM_KEY = new ResolvedTarget(null, null, "sk-platform", null, KeySource.PLATFORM_DB);

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
            doThrow(new AiNotConfiguredException("AI_FEATURE_DISABLED", "analytics",
                "Analytics AI is disabled for this organization"))
                .when(tokenBudgetService).requireFeatureEnabled(
                    org.mockito.ArgumentMatchers.anyLong(),
                    org.mockito.ArgumentMatchers.eq(AiFeature.ANALYTICS));

            assertThrows(AiNotConfiguredException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31)));

            verify(aiProviderRouter, never()).route(anyLong(), anyString(), any(AiFeature.class), any(AiRequest.class));
        }

        @Test
        void validResponse_parsesCorrectly() {
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
                .thenReturn(new RoutedResponse(aiResponse, "anthropic", KeySource.PLATFORM_DB));

            List<AiInsightDto> insights = service.getAiInsights(
                PROPERTY_ID, ORG_ID, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10));

            assertEquals(2, insights.size());
            assertEquals("TREND", insights.get(0).type());
            assertEquals("MEDIUM", insights.get(0).severity());
            assertEquals("RECOMMENDATION", insights.get(1).type());
        }

        @Test
        void budgetExceeded_throws() {
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            doThrow(new AiBudgetExceededException("ANALYTICS", 100_000, 100_000))
                .when(tokenBudgetService).requireBudget(ORG_ID, AiFeature.ANALYTICS, KeySource.PLATFORM_DB);

            assertThrows(AiBudgetExceededException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31)));
        }

        @Test
        void recordsUsage() {
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
                .thenReturn(new RoutedResponse(response, "anthropic", KeySource.PLATFORM_DB));

            service.getAiInsights(PROPERTY_ID, ORG_ID,
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10));

            verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.ANALYTICS), eq("anthropic"), eq(response));
        }

        @Test
        void invalidJson_throwsProviderException() {
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.ANALYTICS)).thenReturn(PLATFORM_KEY);
            setupPropertyAndReservations();
            when(anonymizationService.anonymize(any())).thenAnswer(inv -> inv.getArgument(0));
            AiResponse aiResponse = new AiResponse("not valid json", 20, 10, 30, "claude-3-haiku", "end_turn");
            when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.ANALYTICS), any(AiRequest.class)))
                .thenReturn(new RoutedResponse(aiResponse, "anthropic", KeySource.PLATFORM_DB));

            assertThrows(AiProviderException.class,
                () -> service.getAiInsights(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 10)));
        }
    }
}
