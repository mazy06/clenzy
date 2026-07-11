package com.clenzy.service;

import com.clenzy.dto.DashboardOverviewSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardOverviewSummaryServiceTest {

    private static final Long ORG_ID = 1L;
    private static final String KC_ID = "kc-user";
    // Aujourd'hui fixe : 2026-07-11. Fenêtre 30 j courante = [2026-06-12 .. 2026-07-11].
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 11);
    private static final int DAYS = 30;
    private static final LocalDate CUR_START = TODAY.minusDays(DAYS - 1L);

    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserRepository userRepository;

    private DashboardOverviewSummaryService service;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(
                TODAY.atStartOfDay(ZoneId.of("Europe/Paris")).toInstant(),
                ZoneId.of("Europe/Paris"));
        service = new DashboardOverviewSummaryService(
                propertyRepository, reservationRepository, interventionRepository,
                serviceRequestRepository, userRepository, fixed);
    }

    private void stubActiveProperties(long active) {
        lenient().when(propertyRepository.countForDashboard(eq(ORG_ID), any())).thenReturn(active);
        lenient().when(propertyRepository.countForDashboardByStatus(eq(ORG_ID), any(), eq(PropertyStatus.ACTIVE)))
                .thenReturn(active);
    }

    private Reservation reservation(LocalDate checkIn, LocalDate checkOut, String price, String status) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(new BigDecimal(price));
        r.setStatus(status);
        return r;
    }

    @Test
    void whenReservationSpansWindowBoundary_thenRevenueProratedToWindowNights() {
        // Arrange — 1 logement actif ; résa 10 nuits (1000 €) dont 5 dans la fenêtre courante
        stubActiveProperties(1);
        when(reservationRepository.findOverlappingWindowForDashboard(any(), any(), eq(ORG_ID), isNull()))
                .thenReturn(List.of(reservation(CUR_START.minusDays(5), CUR_START.plusDays(5), "1000", "confirmed")));

        // Act
        DashboardOverviewSummaryDto dto = service.getSummary(ORG_ID, DAYS, UserRole.SUPER_ADMIN, KC_ID);

        // Assert — 5 nuits × (1000/10) = 500 € ; occupation 5/30 ; ADR 100 ; RevPAN 500/30
        assertThat(dto.totalRevenue().value()).isEqualTo(500.0);
        assertThat(dto.occupancyRate().value()).isEqualTo(16.7);
        assertThat(dto.adr().value()).isEqualTo(100.0);
        assertThat(dto.revPan().value()).isEqualTo(16.67);
    }

    @Test
    void whenMoreNightsThanAvailable_thenOccupancyCappedAt100() {
        // Arrange — 1 logement, 2 résas couvrant chacune toute la fenêtre (double-comptage)
        stubActiveProperties(1);
        when(reservationRepository.findOverlappingWindowForDashboard(any(), any(), eq(ORG_ID), isNull()))
                .thenReturn(List.of(
                        reservation(CUR_START, TODAY.plusDays(1), "3000", "confirmed"),
                        reservation(CUR_START, TODAY.plusDays(1), "3000", "confirmed")));

        DashboardOverviewSummaryDto dto = service.getSummary(ORG_ID, DAYS, UserRole.SUPER_ADMIN, KC_ID);

        assertThat(dto.occupancyRate().value()).isEqualTo(100.0);
    }

    @Test
    void whenCancelledReservation_thenExcludedFromKpis() {
        stubActiveProperties(1);
        when(reservationRepository.findOverlappingWindowForDashboard(any(), any(), eq(ORG_ID), isNull()))
                .thenReturn(List.of(reservation(CUR_START, TODAY.plusDays(1), "3000", "cancelled")));

        DashboardOverviewSummaryDto dto = service.getSummary(ORG_ID, DAYS, UserRole.SUPER_ADMIN, KC_ID);

        assertThat(dto.totalRevenue().value()).isZero();
        assertThat(dto.occupancyRate().value()).isZero();
    }

    @Test
    void whenInterventionsInWindow_thenCountersAndRevenueAggregated() {
        stubActiveProperties(1);

        Intervention completedInWindow = new Intervention();
        completedInWindow.setScheduledDate(TODAY.minusDays(3).atStartOfDay());
        completedInWindow.setStatus(InterventionStatus.COMPLETED);
        completedInWindow.setActualCost(new BigDecimal("80"));

        Intervention scheduledToday = new Intervention();
        scheduledToday.setScheduledDate(TODAY.atTime(10, 0));
        scheduledToday.setStatus(InterventionStatus.PENDING);

        Intervention upcomingNextWeek = new Intervention();
        upcomingNextWeek.setScheduledDate(TODAY.plusDays(3).atStartOfDay());
        upcomingNextWeek.setStatus(InterventionStatus.PENDING);

        when(interventionRepository.findForDashboardWindow(any(), any(), eq(ORG_ID), isNull(), isNull()))
                .thenReturn(List.of(completedInWindow, scheduledToday, upcomingNextWeek));

        DashboardOverviewSummaryDto dto = service.getSummary(ORG_ID, DAYS, UserRole.SUPER_ADMIN, KC_ID);

        // total = fenêtre passée (completed + today) ; upcoming = J+3 non terminée
        assertThat(dto.interventions().total()).isEqualTo(2);
        assertThat(dto.interventions().today()).isEqualTo(1);
        assertThat(dto.interventions().upcoming()).isEqualTo(1);
        assertThat(dto.interventions().completed()).isEqualTo(1);
        assertThat(dto.interventions().completionRate()).isEqualTo(50.0);
        assertThat(dto.interventions().totalRevenue()).isEqualByComparingTo("80.00");
    }

    @Test
    void whenOperationalRole_thenFinancialKpisSkippedAndInterventionsScopedToAssignee() {
        stubActiveProperties(5);
        User technician = new User();
        technician.setId(42L);
        when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(technician));

        DashboardOverviewSummaryDto dto = service.getSummary(ORG_ID, DAYS, UserRole.TECHNICIAN, KC_ID);

        assertThat(dto.occupancyRate().value()).isZero();
        assertThat(dto.totalRevenue().value()).isZero();
        verify(reservationRepository, never()).findOverlappingWindowForDashboard(any(), any(), anyLong(), any());
        verify(interventionRepository).findForDashboardWindow(any(), any(), eq(ORG_ID), isNull(), eq(42L));
        // Pas de compteur paiements pour un opérationnel (non affiché)
        assertThat(dto.pendingPaymentsCount()).isZero();
    }

    @Test
    void whenHostRole_thenAllQueriesOwnerScoped() {
        stubActiveProperties(2);
        when(reservationRepository.findOverlappingWindowForDashboard(any(), any(), eq(ORG_ID), eq(KC_ID)))
                .thenReturn(List.of());

        service.getSummary(ORG_ID, DAYS, UserRole.HOST, KC_ID);

        verify(propertyRepository).countForDashboard(ORG_ID, KC_ID);
        verify(reservationRepository).findOverlappingWindowForDashboard(any(), any(), eq(ORG_ID), eq(KC_ID));
        verify(interventionRepository).findForDashboardWindow(any(), any(), eq(ORG_ID), eq(KC_ID), isNull());
        verify(serviceRequestRepository).countWindowForDashboard(any(), any(), eq(ORG_ID), eq(KC_ID));
        verify(userRepository, never()).findByKeycloakId(anyString());
    }
}
