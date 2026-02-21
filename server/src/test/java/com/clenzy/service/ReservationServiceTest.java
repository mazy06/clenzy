package com.clenzy.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.config.SyncMetrics;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CalendarEngine calendarEngine;

    @Mock
    private GuestService guestService;

    @Mock
    private SyncMetrics syncMetrics;

    private TenantContext tenantContext;
    private ReservationService reservationService;

    private Property property;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Long orgId;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        orgId = 1L;
        tenantContext.setOrganizationId(orgId);

        reservationService = new ReservationService(
                reservationRepository,
                userRepository,
                tenantContext,
                calendarEngine,
                guestService,
                syncMetrics
        );

        property = new Property();
        property.setId(1L);

        checkIn = LocalDate.of(2025, 6, 1);
        checkOut = LocalDate.of(2025, 6, 5);

        lenient().when(syncMetrics.startTimer()).thenReturn(mock(Timer.Sample.class));
    }

    @Test
    void save_newConfirmed_callsCalendarEngineBook() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setStatus("confirmed");
        reservation.setSource("AIRBNB");
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkOut);
        // id is null (new reservation)

        when(calendarEngine.book(eq(1L), eq(checkIn), eq(checkOut), isNull(), eq(orgId), eq("AIRBNB"), isNull()))
                .thenReturn(List.of());

        Reservation saved = new Reservation();
        saved.setId(100L);
        saved.setProperty(property);
        saved.setCheckIn(checkIn);
        saved.setCheckOut(checkOut);
        when(reservationRepository.save(reservation)).thenReturn(saved);

        reservationService.save(reservation);

        verify(calendarEngine).book(eq(1L), eq(checkIn), eq(checkOut), isNull(), eq(orgId), eq("AIRBNB"), isNull());
        verify(calendarEngine).linkReservation(eq(1L), eq(checkIn), eq(checkOut), eq(100L), eq(orgId));
    }

    @Test
    void save_conflict_throwsAndIncrementMetric() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setStatus("confirmed");
        reservation.setSource("MANUAL");
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkOut);

        when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                .thenThrow(new CalendarConflictException(1L, checkIn, checkOut, 2));

        assertThrows(CalendarConflictException.class, () -> reservationService.save(reservation));

        verify(syncMetrics).incrementDoubleBookingPrevented();
    }

    @Test
    void save_linksReservation_afterSave() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setStatus("confirmed");
        reservation.setSource("MANUAL");
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkOut);

        when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                .thenReturn(List.of());

        Reservation saved = new Reservation();
        saved.setId(42L);
        saved.setProperty(property);
        saved.setCheckIn(checkIn);
        saved.setCheckOut(checkOut);
        when(reservationRepository.save(reservation)).thenReturn(saved);

        reservationService.save(reservation);

        verify(calendarEngine).linkReservation(eq(1L), eq(checkIn), eq(checkOut), eq(42L), eq(orgId));
    }

    @Test
    void save_autoCreatesGuest() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setStatus("confirmed");
        reservation.setSource("AIRBNB");
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkOut);
        reservation.setGuestName("John Doe");
        // guest is null by default

        Guest guest = new Guest();
        when(guestService.findOrCreateFromName("John Doe", "AIRBNB", orgId)).thenReturn(guest);

        when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                .thenReturn(List.of());

        Reservation saved = new Reservation();
        saved.setId(100L);
        saved.setProperty(property);
        saved.setCheckIn(checkIn);
        saved.setCheckOut(checkOut);
        when(reservationRepository.save(reservation)).thenReturn(saved);

        reservationService.save(reservation);

        verify(guestService).findOrCreateFromName("John Doe", "AIRBNB", orgId);
        assertEquals(guest, reservation.getGuest());
    }

    @Test
    void save_crossTenantRefused() {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(2L); // Different org

        assertThrows(RuntimeException.class, () -> reservationService.save(reservation));

        verify(reservationRepository, never()).save(any(Reservation.class));
    }

    @Test
    void cancel_releasesCalendarDays() {
        Long reservationId = 100L;

        Reservation reservation = new Reservation();
        reservation.setId(reservationId);
        reservation.setOrganizationId(orgId);
        reservation.setStatus("confirmed");
        when(reservationRepository.findById(reservationId)).thenReturn(Optional.of(reservation));

        when(calendarEngine.cancel(eq(reservationId), eq(orgId), isNull())).thenReturn(3);
        when(reservationRepository.save(reservation)).thenReturn(reservation);

        reservationService.cancel(reservationId);

        verify(calendarEngine).cancel(eq(reservationId), eq(orgId), isNull());
        assertEquals("cancelled", reservation.getStatus());
        verify(reservationRepository).save(reservation);
    }
}
