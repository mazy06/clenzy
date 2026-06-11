package com.clenzy.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.config.SyncMetrics;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
    private RateOverrideRepository rateOverrideRepository;

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
    void block_crossOrgProperty_isRejected() {
        // IDOR : propertyId controle par l'appelant (tool LLM), mais la propriete
        // appartient a une AUTRE organisation que celle du caller (orgId=1).
        Property foreign = new Property();
        foreign.setId(propertyId);
        foreign.setOrganizationId(2L); // org tierce
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.countBookedInRange(propertyId, checkIn, checkOut, orgId)).thenReturn(0L);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(foreign));

        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> {
            calendarEngine.block(propertyId, checkIn, checkOut, orgId, source, "Maintenance", actorId);
        });

        // Aucune ecriture calendrier ni outbox event sur l'org tierce.
        verify(calendarDayRepository, never()).saveAll(anyList());
        verify(outboxPublisher, never()).publishCalendarEvent(anyString(), anyLong(), anyLong(), anyString());
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

    // ── updateManualPrice : prix manuel visible du PriceEngine (Z5-BUGS-04) ──

    @Test
    void whenManualPriceIsSet_thenManualRateOverridesAreCreated() {
        // Arrange
        BigDecimal manualPrice = new BigDecimal("180.00");
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of());
        when(rateOverrideRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateManualPrice(propertyId, checkIn, checkOut, manualPrice, orgId, actorId);

        // Assert : un override MANUAL par jour de la plage [checkIn, checkOut)
        ArgumentCaptor<List<RateOverride>> captor = ArgumentCaptor.forClass(List.class);
        verify(rateOverrideRepository).saveAll(captor.capture());
        List<RateOverride> overrides = captor.getValue();
        assertEquals(4, overrides.size());
        for (RateOverride override : overrides) {
            assertEquals("MANUAL", override.getSource());
            assertEquals(manualPrice, override.getNightlyPrice());
            assertEquals(actorId, override.getCreatedBy());
        }
        // L'ecriture calendrier (affichage) reste effectuee
        verify(calendarDayRepository).saveAll(anyList());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_PRICE_UPDATED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void whenManualPriceIsSetOnExistingOverride_thenOverrideIsRewrittenToManual() {
        // Arrange : un override yield existe sur le premier jour
        BigDecimal manualPrice = new BigDecimal("200.00");
        RateOverride yieldOverride = new RateOverride(property, checkIn, new BigDecimal("90.00"), "YIELD_RULE", orgId);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of(yieldOverride));
        when(rateOverrideRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateManualPrice(propertyId, checkIn, checkOut, manualPrice, orgId, actorId);

        // Assert : l'override existant est requalifie MANUAL avec le nouveau prix
        assertEquals("MANUAL", yieldOverride.getSource());
        assertEquals(manualPrice, yieldOverride.getNightlyPrice());
    }

    @Test
    void whenLegacyUpdatePriceIsUsed_thenNoRateOverrideIsCreated() {
        // Arrange : le chemin bas niveau updatePrice (n'ecrit que calendar_days)
        // ne cree pas d'override. Les imports OTA inbound passent desormais par
        // updateExternalPrice (override source OTA:* visible du PriceEngine).
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updatePrice(propertyId, checkIn, checkOut, new BigDecimal("120.00"), orgId, actorId);

        // Assert
        verifyNoInteractions(rateOverrideRepository);
    }

    // ── updateExternalPrice : prix OTA importe visible du PriceEngine (Z5-BUGS-04 reliquat) ──

    @Test
    void whenExternalPriceIsImported_thenOtaRateOverridesAreCreated() {
        // Arrange
        BigDecimal otaPrice = new BigDecimal("175.00");
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of());
        when(rateOverrideRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateExternalPrice(propertyId, checkIn, checkOut, otaPrice, orgId,
                "airbnb-webhook", "AIRBNB");

        // Assert : un override OTA:AIRBNB par jour de la plage [checkIn, checkOut)
        ArgumentCaptor<List<RateOverride>> captor = ArgumentCaptor.forClass(List.class);
        verify(rateOverrideRepository).saveAll(captor.capture());
        List<RateOverride> overrides = captor.getValue();
        assertEquals(4, overrides.size());
        for (RateOverride override : overrides) {
            assertEquals("OTA:AIRBNB", override.getSource());
            assertEquals(otaPrice, override.getNightlyPrice());
            assertEquals("airbnb-webhook", override.getCreatedBy());
        }
        // L'ecriture calendrier (affichage) reste effectuee + event outbox emis
        verify(calendarDayRepository).saveAll(anyList());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_PRICE_UPDATED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void whenExternalPriceImportedOnYieldOverride_thenOverrideIsRewrittenToOta() {
        // Arrange : un override yield existe sur le premier jour -> remplace par l'OTA
        BigDecimal otaPrice = new BigDecimal("160.00");
        RateOverride yieldOverride = new RateOverride(property, checkIn, new BigDecimal("90.00"), "YIELD_RULE", orgId);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of(yieldOverride));
        when(rateOverrideRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateExternalPrice(propertyId, checkIn, checkOut, otaPrice, orgId,
                "booking-webhook", "BOOKING");

        // Assert : l'override yield est requalifie OTA:BOOKING avec le prix importe
        assertEquals("OTA:BOOKING", yieldOverride.getSource());
        assertEquals(otaPrice, yieldOverride.getNightlyPrice());
    }

    @Test
    void whenExternalPriceImportedOnManualOverride_thenManualPriceIsPreserved() {
        // Arrange : un prix MANUEL (saisi par l'hote) existe sur le premier jour.
        // L'import OTA ne doit pas l'ecraser (l'intention de l'hote prime).
        BigDecimal otaPrice = new BigDecimal("200.00");
        BigDecimal hostPrice = new BigDecimal("250.00");
        RateOverride manualOverride = new RateOverride(property, checkIn, hostPrice, "MANUAL", orgId);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, checkIn, checkOut, orgId))
                .thenReturn(List.of(manualOverride));
        when(rateOverrideRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateExternalPrice(propertyId, checkIn, checkOut, otaPrice, orgId,
                "expedia-webhook", "VRBO");

        // Assert : le jour MANUEL est intact, les 3 autres jours recoivent un override OTA:VRBO
        assertEquals("MANUAL", manualOverride.getSource());
        assertEquals(hostPrice, manualOverride.getNightlyPrice());

        ArgumentCaptor<List<RateOverride>> captor = ArgumentCaptor.forClass(List.class);
        verify(rateOverrideRepository).saveAll(captor.capture());
        List<RateOverride> saved = captor.getValue();
        assertEquals(3, saved.size());
        for (RateOverride override : saved) {
            assertEquals("OTA:VRBO", override.getSource());
            assertEquals(otaPrice, override.getNightlyPrice());
        }
    }

    @Test
    void whenExternalPriceIsNull_thenNoOverrideIsCreated() {
        // Arrange : un prix null (champ absent du payload OTA) ne cree aucun override
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(calendarDayRepository.findByPropertyAndDateRange(propertyId, checkIn, checkOut.minusDays(1), orgId))
                .thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        calendarEngine.updateExternalPrice(propertyId, checkIn, checkOut, null, orgId,
                "airbnb-webhook", "AIRBNB");

        // Assert
        verifyNoInteractions(rateOverrideRepository);
    }

    // ── move : deplacement d'une reservation (Z5-BUGS-01) ───────────────────

    private CalendarEngine.ReservationMove sampleMove(LocalDate newCheckIn, LocalDate newCheckOut) {
        return new CalendarEngine.ReservationMove(
                reservationId, orgId,
                propertyId, checkIn, checkOut,
                propertyId, newCheckIn, newCheckOut,
                source, actorId);
    }

    @Test
    void move_releasesOldDaysBooksNewOnes_andPublishesBothOutboxEvents() {
        // Arrange
        LocalDate newCheckIn = checkIn.plusDays(10);
        LocalDate newCheckOut = checkOut.plusDays(10);

        Reservation reservation = new Reservation();
        reservation.setId(reservationId);
        reservation.setProperty(property);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.releaseByReservation(reservationId, orgId)).thenReturn(4);
        when(restrictionEngine.validate(propertyId, newCheckIn, newCheckOut, orgId))
                .thenReturn(RestrictionEngine.ValidationResult.valid());
        when(calendarDayRepository.countConflicts(propertyId, newCheckIn, newCheckOut, orgId)).thenReturn(0L);
        when(priceEngine.resolvePriceRange(propertyId, newCheckIn, newCheckOut, orgId)).thenReturn(Map.of());
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(reservationRepository.findById(reservationId)).thenReturn(Optional.of(reservation));
        when(calendarDayRepository.findByPropertyAndDateRange(
                propertyId, newCheckIn, newCheckOut.minusDays(1), orgId)).thenReturn(List.of());

        ArgumentCaptor<List<CalendarDay>> captor = ArgumentCaptor.forClass(List.class);
        when(calendarDayRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        List<CalendarDay> result = calendarEngine.move(sampleMove(newCheckIn, newCheckOut));

        // Assert : anciens jours liberes
        verify(calendarDayRepository).releaseByReservation(reservationId, orgId);
        // Nouveaux jours reserves et lies a la reservation
        assertEquals(4, result.size());
        List<CalendarDay> savedDays = captor.getValue();
        for (CalendarDay day : savedDays) {
            assertEquals(CalendarDayStatus.BOOKED, day.getStatus());
            assertEquals(reservation, day.getReservation());
            assertFalse(day.getDate().isBefore(newCheckIn));
            assertTrue(day.getDate().isBefore(newCheckOut));
        }
        // Deux events outbox publies (sync channels)
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_CANCELLED"), eq(propertyId), eq(orgId), anyString());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_BOOKED"), eq(propertyId), eq(orgId), anyString());
    }

    @Test
    void move_conflictOnNewRange_throwsAndDoesNotBook() {
        // Arrange
        LocalDate newCheckIn = checkIn.plusDays(10);
        LocalDate newCheckOut = checkOut.plusDays(10);

        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(true);
        when(calendarDayRepository.releaseByReservation(reservationId, orgId)).thenReturn(4);
        when(restrictionEngine.validate(propertyId, newCheckIn, newCheckOut, orgId))
                .thenReturn(RestrictionEngine.ValidationResult.valid());
        when(calendarDayRepository.countConflicts(propertyId, newCheckIn, newCheckOut, orgId)).thenReturn(2L);

        // Act & Assert : l'exception remonte (rollback transactionnel complet en prod)
        assertThrows(CalendarConflictException.class,
                () -> calendarEngine.move(sampleMove(newCheckIn, newCheckOut)));

        verify(syncMetrics).incrementConflictDetected();
        verify(calendarDayRepository, never()).saveAll(anyList());
        verify(outboxPublisher, never()).publishCalendarEvent(eq("CALENDAR_BOOKED"), anyLong(), anyLong(), anyString());
    }

    @Test
    void move_lockFailed_throwsCalendarLockException() {
        when(calendarDayRepository.acquirePropertyLock(propertyId)).thenReturn(false);

        assertThrows(CalendarLockException.class,
                () -> calendarEngine.move(sampleMove(checkIn.plusDays(10), checkOut.plusDays(10))));

        verify(syncMetrics).incrementLockContention();
        verify(calendarDayRepository, never()).releaseByReservation(anyLong(), anyLong());
        verify(calendarDayRepository, never()).saveAll(anyList());
    }

    @Test
    void move_distinctProperties_acquiresBothLocksInIdOrder() {
        // Arrange : move de la propriete 2 vers la propriete 1
        Long oldPropertyId = 2L;
        LocalDate newCheckIn = checkIn.plusDays(10);
        LocalDate newCheckOut = checkOut.plusDays(10);

        Reservation reservation = new Reservation();
        reservation.setId(reservationId);
        reservation.setProperty(property);

        when(calendarDayRepository.acquirePropertyLock(anyLong())).thenReturn(true);
        when(calendarDayRepository.releaseByReservation(reservationId, orgId)).thenReturn(4);
        when(restrictionEngine.validate(propertyId, newCheckIn, newCheckOut, orgId))
                .thenReturn(RestrictionEngine.ValidationResult.valid());
        when(calendarDayRepository.countConflicts(propertyId, newCheckIn, newCheckOut, orgId)).thenReturn(0L);
        when(priceEngine.resolvePriceRange(propertyId, newCheckIn, newCheckOut, orgId)).thenReturn(Map.of());
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(reservationRepository.findById(reservationId)).thenReturn(Optional.of(reservation));
        when(calendarDayRepository.findByPropertyAndDateRange(
                propertyId, newCheckIn, newCheckOut.minusDays(1), orgId)).thenReturn(List.of());
        when(calendarDayRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        CalendarEngine.ReservationMove move = new CalendarEngine.ReservationMove(
                reservationId, orgId,
                oldPropertyId, checkIn, checkOut,
                propertyId, newCheckIn, newCheckOut,
                source, actorId);

        // Act
        calendarEngine.move(move);

        // Assert : lock id croissant d'abord (1 puis 2), puis re-acquisition par book (1)
        InOrder inOrder = inOrder(calendarDayRepository);
        inOrder.verify(calendarDayRepository).acquirePropertyLock(1L);
        inOrder.verify(calendarDayRepository).acquirePropertyLock(2L);
        verify(calendarDayRepository).releaseByReservation(reservationId, orgId);
        // L'event CANCELLED porte sur l'ancienne propriete, le BOOKED sur la nouvelle
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_CANCELLED"), eq(oldPropertyId), eq(orgId), anyString());
        verify(outboxPublisher).publishCalendarEvent(eq("CALENDAR_BOOKED"), eq(propertyId), eq(orgId), anyString());
    }
}
