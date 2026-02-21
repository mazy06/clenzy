package com.clenzy.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.config.SyncMetrics;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CalendarEngineTest {

    @Mock
    private CalendarDayRepository calendarDayRepository;

    @Mock
    private CalendarCommandRepository calendarCommandRepository;

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private OutboxPublisher outboxPublisher;

    @Mock
    private RestrictionEngine restrictionEngine;

    @Mock
    private PriceEngine priceEngine;

    @Mock
    private SyncMetrics syncMetrics;

    @InjectMocks
    private CalendarEngine calendarEngine;

    private Long propertyId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Long reservationId;
    private Long orgId;
    private String source;
    private String actorId;
    private Property property;
    private Timer.Sample timerSample;

    @BeforeEach
    void setUp() {
        propertyId = 1L;
        checkIn = LocalDate.of(2025, 6, 1);
        checkOut = LocalDate.of(2025, 6, 5);
        reservationId = 100L;
        orgId = 1L;
        source = "AIRBNB";
        actorId = "test-user";

        property = new Property();
        property.setId(propertyId);

        timerSample = mock(Timer.Sample.class);
        lenient().when(syncMetrics.startTimer()).thenReturn(timerSample);
        lenient().doNothing().when(syncMetrics).recordCalendarOperation(anyString(), any(Timer.Sample.class));
        lenient().doNothing().when(syncMetrics).incrementConflictDetected();
        lenient().doNothing().when(syncMetrics).incrementLockContention();
    }

    @Test
    void book_success() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId)).thenReturn(0L);

        RestrictionEngine.ValidationResult validResult = RestrictionEngine.ValidationResult.valid();
        when(restrictionEngine.validate(propertyId, checkIn, checkOut, orgId)).thenReturn(validResult);

        Map<LocalDate, BigDecimal> priceMap = Map.of(
                checkIn, new BigDecimal("100.00"),
                checkIn.plusDays(1), new BigDecimal("100.00"),
                checkIn.plusDays(2), new BigDecimal("100.00"),
                checkIn.plusDays(3), new BigDecimal("100.00")
        );
        when(priceEngine.resolvePriceRange(propertyId, checkIn, checkOut, orgId)).thenReturn(priceMap);

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        List<CalendarDay> result = calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);

        assertNotNull(result);
        verify(calendarDayRepository).saveAll(anyList());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_BOOKED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void book_conflict() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);

        RestrictionEngine.ValidationResult validResult = RestrictionEngine.ValidationResult.valid();
        when(restrictionEngine.validate(propertyId, checkIn, checkOut, orgId)).thenReturn(validResult);

        when(calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId)).thenReturn(2L);

        assertThrows(CalendarConflictException.class, () -> {
            calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);
        });

        verify(syncMetrics).incrementConflictDetected();
        verify(calendarDayRepository, never()).saveAll(anyList());
    }

    @Test
    void book_lockFailed() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(false);

        assertThrows(CalendarLockException.class, () -> {
            calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);
        });

        verify(syncMetrics).incrementLockContention();
        verify(calendarDayRepository, never()).saveAll(anyList());
    }

    @Test
    void book_restrictionViolation() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);

        RestrictionEngine.ValidationResult invalidResult =
                RestrictionEngine.ValidationResult.invalid(List.of("Minimum stay violation"));
        when(restrictionEngine.validate(propertyId, checkIn, checkOut, orgId)).thenReturn(invalidResult);

        assertThrows(RestrictionViolationException.class, () -> {
            calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);
        });

        verify(calendarDayRepository, never()).saveAll(anyList());
    }

    @Test
    void book_publishesOutboxEvent() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId)).thenReturn(0L);

        RestrictionEngine.ValidationResult validResult = RestrictionEngine.ValidationResult.valid();
        when(restrictionEngine.validate(propertyId, checkIn, checkOut, orgId)).thenReturn(validResult);

        Map<LocalDate, BigDecimal> priceMap = Map.of(checkIn, new BigDecimal("100.00"));
        when(priceEngine.resolvePriceRange(propertyId, checkIn, checkOut, orgId)).thenReturn(priceMap);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);

        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_BOOKED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void book_setsNightlyPrice() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId)).thenReturn(0L);

        RestrictionEngine.ValidationResult validResult = RestrictionEngine.ValidationResult.valid();
        when(restrictionEngine.validate(propertyId, checkIn, checkOut, orgId)).thenReturn(validResult);

        Map<LocalDate, BigDecimal> priceMap = Map.of(
                checkIn, new BigDecimal("100.00"),
                checkIn.plusDays(1), new BigDecimal("150.00")
        );
        when(priceEngine.resolvePriceRange(propertyId, checkIn, checkOut, orgId)).thenReturn(priceMap);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));

        ArgumentCaptor<List<CalendarDay>> captor = ArgumentCaptor.forClass(List.class);
        when(calendarDayRepository.saveAll(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        calendarEngine.book(propertyId, checkIn, checkOut, reservationId, orgId, source, actorId);

        List<CalendarDay> savedDays = captor.getValue();
        assertFalse(savedDays.isEmpty());
        assertEquals(new BigDecimal("100.00"), savedDays.get(0).getNightlyPrice());
    }

    @Test
    void cancel_success() {
        Reservation reservation = new Reservation();
        reservation.setId(reservationId);
        reservation.setProperty(property);

        when(reservationRepository.findById(reservationId)).thenReturn(Optional.of(reservation));
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.releaseByReservation(reservationId, orgId)).thenReturn(3);

        int result = calendarEngine.cancel(reservationId, orgId, actorId);

        assertEquals(3, result);
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_CANCELLED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void block_success() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countBookedInRange(propertyId, checkIn, checkOut, orgId)).thenReturn(0L);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));

        ArgumentCaptor<List<CalendarDay>> captor = ArgumentCaptor.forClass(List.class);
        when(calendarDayRepository.saveAll(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        List<CalendarDay> result = calendarEngine.block(propertyId, checkIn, checkOut, orgId, source, "Maintenance", actorId);

        assertNotNull(result);
        List<CalendarDay> savedDays = captor.getValue();
        assertFalse(savedDays.isEmpty());
        assertEquals(CalendarDayStatus.BLOCKED, savedDays.get(0).getStatus());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_BLOCKED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void block_onBookedDays() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countBookedInRange(propertyId, checkIn, checkOut, orgId)).thenReturn(2L);

        assertThrows(CalendarConflictException.class, () -> {
            calendarEngine.block(propertyId, checkIn, checkOut, orgId, source, "Maintenance", actorId);
        });

        verify(calendarDayRepository, never()).saveAll(anyList());
    }

    @Test
    void unblock_success() {
        CalendarDay day1 = new CalendarDay(property, checkIn, CalendarDayStatus.BLOCKED, orgId);
        CalendarDay day2 = new CalendarDay(property, checkIn.plusDays(1), CalendarDayStatus.BLOCKED, orgId);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.findBlockedInRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of(day1, day2));

        when(calendarDayRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        int result = calendarEngine.unblock(propertyId, checkIn, checkOut, orgId, actorId);

        assertEquals(2, result);
        assertEquals(CalendarDayStatus.AVAILABLE, day1.getStatus());
        assertEquals(CalendarDayStatus.AVAILABLE, day2.getStatus());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_UNBLOCKED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void updatePrice_success() {
        BigDecimal newPrice = new BigDecimal("200.00");

        CalendarDay existingDay = new CalendarDay(property, checkIn, CalendarDayStatus.AVAILABLE, orgId);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of(existingDay));

        when(calendarDayRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        calendarEngine.updatePrice(propertyId, checkIn, checkOut, newPrice, orgId, actorId);

        verify(calendarDayRepository).saveAll(anyList());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_PRICE_UPDATED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void linkReservation_delegates() {
        calendarEngine.linkReservation(propertyId, checkIn, checkOut, reservationId, orgId);

        verify(calendarDayRepository).linkReservation(propertyId, checkIn, checkOut, reservationId, orgId);
    }
}
