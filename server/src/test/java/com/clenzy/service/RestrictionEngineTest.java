package com.clenzy.service;

import com.clenzy.model.BookingRestriction;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestrictionEngineTest {

    @Mock
    private BookingRestrictionRepository restrictionRepository;

    @InjectMocks
    private RestrictionEngine restrictionEngine;

    private Property property;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Long orgId;

    @BeforeEach
    void setUp() {
        property = new Property();
        property.setId(1L);
        checkIn = LocalDate.of(2025, 6, 1);
        checkOut = LocalDate.of(2025, 6, 5);
        orgId = 1L;
    }

    @Test
    void validate_noRestrictions_returnsValid() {
        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(Collections.emptyList());

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertTrue(result.isValid());
        assertTrue(result.getViolations().isEmpty());
    }

    @Test
    void validate_minStay_violation() {
        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(checkIn.minusDays(1));
        restriction.setEndDate(checkOut.plusDays(1));
        restriction.setMinStay(5);
        restriction.setMaxStay(null);
        restriction.setClosedToArrival(false);
        restriction.setClosedToDeparture(false);
        restriction.setAdvanceNoticeDays(null);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        // 4 nights stay (June 1-5), minStay=5 so violation
        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertFalse(result.isValid());
        assertFalse(result.getViolations().isEmpty());
        assertTrue(result.getViolations().get(0).toLowerCase().contains("minimum"));
    }

    @Test
    void validate_maxStay_violation() {
        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(checkIn.minusDays(1));
        restriction.setEndDate(checkIn.plusDays(30));
        restriction.setMinStay(null);
        restriction.setMaxStay(7);
        restriction.setClosedToArrival(false);
        restriction.setClosedToDeparture(false);
        restriction.setAdvanceNoticeDays(null);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        LocalDate longCheckOut = checkIn.plusDays(10); // 10 nights
        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, longCheckOut, orgId);

        assertFalse(result.isValid());
        assertFalse(result.getViolations().isEmpty());
    }

    @Test
    void validate_closedToArrival_violation() {
        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(checkIn.minusDays(1));
        restriction.setEndDate(checkOut.plusDays(1));
        restriction.setMinStay(null);
        restriction.setMaxStay(null);
        restriction.setClosedToArrival(true);
        restriction.setClosedToDeparture(false);
        restriction.setAdvanceNoticeDays(null);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertFalse(result.isValid());
        assertFalse(result.getViolations().isEmpty());
    }

    @Test
    void validate_closedToDeparture_violation() {
        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(checkIn.minusDays(1));
        restriction.setEndDate(checkOut.plusDays(1));
        restriction.setMinStay(null);
        restriction.setMaxStay(null);
        restriction.setClosedToArrival(false);
        restriction.setClosedToDeparture(true);
        restriction.setAdvanceNoticeDays(null);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertFalse(result.isValid());
        assertFalse(result.getViolations().isEmpty());
    }

    @Test
    void validate_advanceNotice_violation() {
        // Check-in in 2 days, but advance notice requires 7 days
        LocalDate nearCheckIn = LocalDate.now().plusDays(2);
        LocalDate nearCheckOut = nearCheckIn.plusDays(3);

        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(nearCheckIn.minusDays(1));
        restriction.setEndDate(nearCheckOut.plusDays(1));
        restriction.setMinStay(null);
        restriction.setMaxStay(null);
        restriction.setClosedToArrival(false);
        restriction.setClosedToDeparture(false);
        restriction.setAdvanceNoticeDays(7);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, nearCheckIn, nearCheckOut, orgId);

        assertFalse(result.isValid());
        assertFalse(result.getViolations().isEmpty());
    }

    @Test
    void validate_highestPriority_wins() {
        BookingRestriction highPriority = new BookingRestriction();
        highPriority.setStartDate(checkIn.minusDays(1));
        highPriority.setEndDate(checkOut.plusDays(1));
        highPriority.setMinStay(2);
        highPriority.setMaxStay(null);
        highPriority.setClosedToArrival(false);
        highPriority.setClosedToDeparture(false);
        highPriority.setAdvanceNoticeDays(null);
        highPriority.setPriority(10);

        BookingRestriction lowPriority = new BookingRestriction();
        lowPriority.setStartDate(checkIn.minusDays(1));
        lowPriority.setEndDate(checkOut.plusDays(1));
        lowPriority.setMinStay(5);
        lowPriority.setMaxStay(null);
        lowPriority.setClosedToArrival(false);
        lowPriority.setClosedToDeparture(false);
        lowPriority.setAdvanceNoticeDays(null);
        lowPriority.setPriority(5);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(lowPriority, highPriority))); // Unsorted order

        // 4 nights - passes minStay=2 from high priority, would fail minStay=5 from low priority
        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertTrue(result.isValid());
    }

    @Test
    void validate_restrictionDoesNotApply_skipped() {
        // Restriction dates are far from checkIn, so appliesTo(checkIn) returns false
        BookingRestriction restriction = new BookingRestriction();
        restriction.setStartDate(checkIn.plusDays(30));
        restriction.setEndDate(checkIn.plusDays(60));
        restriction.setMinStay(10);
        restriction.setMaxStay(null);
        restriction.setClosedToArrival(false);
        restriction.setClosedToDeparture(false);
        restriction.setAdvanceNoticeDays(null);
        restriction.setPriority(10);

        when(restrictionRepository.findApplicable(anyLong(), any(LocalDate.class), any(LocalDate.class), anyLong()))
                .thenReturn(new ArrayList<>(List.of(restriction)));

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(1L, checkIn, checkOut, orgId);

        assertTrue(result.isValid());
        assertTrue(result.getViolations().isEmpty());
    }
}
