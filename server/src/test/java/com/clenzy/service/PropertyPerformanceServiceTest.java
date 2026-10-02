package com.clenzy.service;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Définitions métier standard (Baitly Académie ép. 01) appliquées au score de performance :
 * nuits disponibles = nuits de la fenêtre hors blocages non vendus, revenu = CA hébergement seul.
 */
@ExtendWith(MockitoExtension.class)
class PropertyPerformanceServiceTest {

    private static final Long ORG_ID = 1L;
    // Aujourd'hui fixe : 2026-07-11. Fenêtre 30 j = les 30 nuits [2026-06-12, 2026-07-12).
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 11);
    private static final int DAYS = 30;
    private static final LocalDate WINDOW_START = TODAY.minusDays(DAYS - 1L);
    private static final LocalDate WINDOW_END = TODAY.plusDays(1);

    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private CalendarDayRepository calendarDayRepository;

    private PropertyPerformanceService service;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(
                TODAY.atStartOfDay(ZoneId.of("Europe/Paris")).toInstant(),
                ZoneId.of("Europe/Paris"));
        service = new PropertyPerformanceService(
                propertyRepository, reservationRepository, interventionRepository, calendarDayRepository, fixed);
    }

    private static Property property(long id) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(ORG_ID);
        p.setName("Logement " + id);
        return p;
    }

    private static Reservation stay(Property property, LocalDate checkIn, LocalDate checkOut, String totalPrice) {
        Reservation r = new Reservation();
        r.setProperty(property);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(new BigDecimal(totalPrice));
        return r;
    }

    private static List<CalendarDay> blockedNights(Property property, LocalDate from, int count) {
        List<CalendarDay> days = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            days.add(new CalendarDay(property, from.plusDays(i), CalendarDayStatus.BLOCKED, ORG_ID));
        }
        return days;
    }

    private void givenProperty(Property property, Reservation... reservations) {
        when(propertyRepository.findById(property.getId())).thenReturn(Optional.of(property));
        when(reservationRepository.findByPropertyId(property.getId(), ORG_ID)).thenReturn(List.of(reservations));
    }

    private void givenClosedNights(Property property, LocalDate from, LocalDate to, List<CalendarDay> days) {
        when(calendarDayRepository.findBlockedOrMaintenanceForProperties(List.of(property.getId()), from, to, ORG_ID))
                .thenReturn(days);
    }

    // ── Nuits disponibles = nuits proposées à la vente ──

    @Test
    void whenOwnerBlocksNights_thenOccupancyAndRevPanUseNightsOpenForSale() {
        // Arrange : 30 nuits, 10 bloquées non vendues → 20 en vente ; 10 vendues pour 1000
        Property p = property(10L);
        givenProperty(p, stay(p, WINDOW_START, WINDOW_START.plusDays(10), "1000"));
        givenClosedNights(p, WINDOW_START, WINDOW_END, blockedNights(p, WINDOW_START.plusDays(15), 10));

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert : occupation 10/20, RevPAN 1000/20
        assertThat(perf.occupancyRate()).isEqualTo(50.0);
        assertThat(perf.revPan()).isEqualByComparingTo("50.00");
    }

    @Test
    void whenBlockedNightCarriesAStay_thenTheSoldNightStaysAvailable() {
        // Arrange : blocage en conflit avec un séjour (import OTA) — la nuit vendue était en vente
        Property p = property(10L);
        givenProperty(p, stay(p, WINDOW_START, WINDOW_START.plusDays(6), "600"));
        givenClosedNights(p, WINDOW_START, WINDOW_END, blockedNights(p, WINDOW_START.plusDays(2), 2));

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert : aucune nuit retirée → 6/30
        assertThat(perf.occupancyRate()).isEqualTo(20.0);
        assertThat(perf.revPan()).isEqualByComparingTo("20.00");
    }

    @Test
    void whenWholeWindowIsBlocked_thenOccupancyAndRevPanAreZero() {
        // Arrange : aucune nuit en vente — pas de division par zéro
        Property p = property(10L);
        givenProperty(p);
        givenClosedNights(p, WINDOW_START, WINDOW_END, blockedNights(p, WINDOW_START, DAYS));

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert
        assertThat(perf.occupancyRate()).isZero();
        assertThat(perf.revPan()).isEqualByComparingTo("0");
    }

    @Test
    void whenPropertyIsBookedEveryNight_thenRevPanEqualsTheNightlyRate() {
        // Arrange : séjour à 100 €/nuit couvrant aussi la nuit d'avant la fenêtre (31 nuits, 3100)
        Property p = property(10L);
        givenProperty(p, stay(p, WINDOW_START.minusDays(1), WINDOW_END, "3100"));

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert : la fenêtre compte exactement DAYS nuits — RevPAN d'un logement plein = prix de la nuit
        assertThat(perf.revenue()).isEqualByComparingTo("3000.00");
        assertThat(perf.revPan()).isEqualByComparingTo("100.00");
        assertThat(perf.occupancyRate()).isEqualTo(100.0);
    }

    // ── Chiffre d'affaires = hébergement seul ──

    @Test
    void whenTotalPriceIncludesCleaningAndTouristTax_thenRevenueIsAccommodationOnly() {
        // Arrange : 5 nuits, total 620 = 500 hébergement + 80 ménage + 40 taxe de séjour
        Property p = property(10L);
        Reservation r = stay(p, WINDOW_START, WINDOW_START.plusDays(5), "620");
        r.setCleaningFee(new BigDecimal("80"));
        r.setTouristTaxAmount(new BigDecimal("40"));
        givenProperty(p, r);

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert
        assertThat(perf.revenue()).isEqualByComparingTo("500.00");
        assertThat(perf.revPan()).isEqualByComparingTo("16.67");
    }

    @Test
    void whenTotalPriceIncludesServiceOptions_thenOptionsAreExcludedFromRevenue() {
        // Arrange : 5 nuits, total 560 = 500 hébergement + 60 d'options
        Property p = property(10L);
        Reservation r = stay(p, WINDOW_START, WINDOW_START.plusDays(5), "560");
        r.setServiceOptionsTotal(new BigDecimal("60"));
        givenProperty(p, r);

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert
        assertThat(perf.revenue()).isEqualByComparingTo("500.00");
    }

    @Test
    void whenReservationIsCancelled_thenItCountsNeitherNightsNorRevenue() {
        // Arrange
        Property p = property(10L);
        Reservation cancelled = stay(p, WINDOW_START, WINDOW_START.plusDays(5), "500");
        cancelled.markCancelled();
        givenProperty(p, cancelled);

        // Act
        PropertyPerformanceDto perf = service.compute(p.getId(), DAYS);

        // Assert
        assertThat(perf.occupancyRate()).isZero();
        assertThat(perf.revenue()).isEqualByComparingTo("0");
    }

    // ── Classement du portefeuille (batch) ──

    @Test
    void whenPortfolioHasBlockedNights_thenEachPropertyUsesItsOwnNightsOpenForSale() {
        // Arrange : P1 vend 10 nuits et bloque 5 nuits que P2 a vendues ;
        //           P2 vend 10 nuits et bloque 1 nuit que P1 a vendue.
        Property p1 = property(1L);
        Property p2 = property(2L);
        when(propertyRepository.findByOrganizationIdAndStatus(ORG_ID, PropertyStatus.ACTIVE))
                .thenReturn(List.of(p1, p2));
        when(reservationRepository.findByPropertyIdsOverlappingWindow(eq(List.of(1L, 2L)), any(), any(), eq(ORG_ID)))
                .thenReturn(List.of(
                        stay(p1, WINDOW_START, WINDOW_START.plusDays(10), "1000"),
                        stay(p2, WINDOW_START.plusDays(15), WINDOW_START.plusDays(25), "1000")));
        List<CalendarDay> closed = new ArrayList<>(blockedNights(p1, WINDOW_START.plusDays(15), 5));
        closed.addAll(blockedNights(p2, WINDOW_START.plusDays(2), 1));
        when(calendarDayRepository.findBlockedOrMaintenanceForProperties(
                List.of(1L, 2L), WINDOW_START, WINDOW_END, ORG_ID))
                .thenReturn(closed);

        // Act
        List<PropertyPerformanceDto> ranking = service.computeSummaries(ORG_ID, DAYS);

        // Assert : P1 10/25, P2 10/29 — en une seule requête calendrier pour tout le portefeuille
        assertThat(ranking).filteredOn(d -> d.propertyId().equals(1L))
                .singleElement().extracting(PropertyPerformanceDto::occupancyRate).isEqualTo(40.0);
        assertThat(ranking).filteredOn(d -> d.propertyId().equals(2L))
                .singleElement().extracting(PropertyPerformanceDto::occupancyRate).isEqualTo(34.5);
        verify(calendarDayRepository, times(1))
                .findBlockedOrMaintenanceForProperties(any(), any(), any(), any());
    }

    // ── Occupation à venir (décisions tarifaires) ──

    @Test
    void whenUpcomingNightsAreBlocked_thenForwardOccupancyUsesNightsOpenForSale() {
        // Arrange : 30 nuits à venir, 10 vendues, 10 bloquées non vendues → 10/20
        Property p = property(10L);
        givenProperty(p, stay(p, TODAY, TODAY.plusDays(10), "1000"));
        givenClosedNights(p, TODAY, TODAY.plusDays(DAYS), blockedNights(p, TODAY.plusDays(20), 10));

        // Act
        double occupancy = service.forwardOccupancyRate(p.getId(), DAYS);

        // Assert
        assertThat(occupancy).isEqualTo(50.0);
    }
}
