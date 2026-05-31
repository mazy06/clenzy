package com.clenzy.dto;

import com.clenzy.model.BookingRestriction;
import com.clenzy.model.Property;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class BookingRestrictionDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        Integer[] daysOfWeek = new Integer[]{1, 2, 3};
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 30);
        LocalDateTime createdAt = LocalDateTime.of(2026, 5, 1, 10, 0);

        BookingRestrictionDto dto = new BookingRestrictionDto(
            10L, 99L, start, end, 2, 7, true, false, 1, 14, daysOfWeek, 5, createdAt
        );

        assertEquals(10L, dto.id());
        assertEquals(99L, dto.propertyId());
        assertEquals(start, dto.startDate());
        assertEquals(end, dto.endDate());
        assertEquals(2, dto.minStay());
        assertEquals(7, dto.maxStay());
        assertTrue(dto.closedToArrival());
        assertFalse(dto.closedToDeparture());
        assertEquals(1, dto.gapDays());
        assertEquals(14, dto.advanceNoticeDays());
        assertArrayEquals(daysOfWeek, dto.daysOfWeek());
        assertEquals(5, dto.priority());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        Property property = new Property();
        property.setId(77L);

        BookingRestriction restriction = new BookingRestriction();
        restriction.setId(1L);
        restriction.setProperty(property);
        restriction.setStartDate(LocalDate.of(2026, 7, 1));
        restriction.setEndDate(LocalDate.of(2026, 7, 31));
        restriction.setMinStay(3);
        restriction.setMaxStay(14);
        restriction.setClosedToArrival(true);
        restriction.setClosedToDeparture(true);
        restriction.setGapDays(2);
        restriction.setAdvanceNoticeDays(7);
        restriction.setDaysOfWeek(new Integer[]{5, 6, 7});
        restriction.setPriority(10);

        BookingRestrictionDto dto = BookingRestrictionDto.from(restriction);

        assertEquals(1L, dto.id());
        assertEquals(77L, dto.propertyId());
        assertEquals(LocalDate.of(2026, 7, 1), dto.startDate());
        assertEquals(LocalDate.of(2026, 7, 31), dto.endDate());
        assertEquals(3, dto.minStay());
        assertEquals(14, dto.maxStay());
        assertTrue(dto.closedToArrival());
        assertTrue(dto.closedToDeparture());
        assertEquals(2, dto.gapDays());
        assertEquals(7, dto.advanceNoticeDays());
        assertArrayEquals(new Integer[]{5, 6, 7}, dto.daysOfWeek());
        assertEquals(10, dto.priority());
        // createdAt provient de Hibernate (@CreationTimestamp) — null sans persistance
        assertNull(dto.createdAt());
    }

    @Test
    void from_nullCollectionsAndPriority_returnsExpectedDefaults() {
        Property property = new Property();
        property.setId(123L);

        BookingRestriction restriction = new BookingRestriction();
        restriction.setProperty(property);
        restriction.setStartDate(LocalDate.of(2026, 8, 1));
        restriction.setEndDate(LocalDate.of(2026, 8, 7));

        BookingRestrictionDto dto = BookingRestrictionDto.from(restriction);

        assertEquals(123L, dto.propertyId());
        // Entity defaults
        assertFalse(dto.closedToArrival());
        assertFalse(dto.closedToDeparture());
        assertEquals(0, dto.gapDays());
        assertEquals(0, dto.priority());
        assertNull(dto.minStay());
        assertNull(dto.maxStay());
        assertNull(dto.advanceNoticeDays());
        assertNull(dto.daysOfWeek());
    }

    @Test
    void record_equalityByValue() {
        LocalDate s = LocalDate.of(2026, 1, 1);
        LocalDate e = LocalDate.of(2026, 1, 31);
        BookingRestrictionDto a = new BookingRestrictionDto(
            1L, 1L, s, e, 1, 5, false, false, 0, 0, null, 0, null);
        BookingRestrictionDto b = new BookingRestrictionDto(
            1L, 1L, s, e, 1, 5, false, false, 0, 0, null, 0, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
