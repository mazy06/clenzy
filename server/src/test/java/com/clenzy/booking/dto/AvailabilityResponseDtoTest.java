package com.clenzy.booking.dto;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AvailabilityResponseDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        LocalDate checkIn = LocalDate.of(2026, 6, 1);
        LocalDate checkOut = LocalDate.of(2026, 6, 4);
        AvailabilityResponseDto.NightBreakdown n1 = new AvailabilityResponseDto.NightBreakdown(
                checkIn, new BigDecimal("100.00"), "BASE");
        AvailabilityResponseDto.NightBreakdown n2 = new AvailabilityResponseDto.NightBreakdown(
                checkIn.plusDays(1), new BigDecimal("120.00"), "SEASONAL");
        List<AvailabilityResponseDto.NightBreakdown> breakdown = List.of(n1, n2);
        List<String> violations = List.of();

        AvailabilityResponseDto dto = new AvailabilityResponseDto(
                true,
                10L, "Villa Sun",
                checkIn, checkOut,
                2, 3,
                breakdown,
                new BigDecimal("330.00"),
                new BigDecimal("50.00"),
                new BigDecimal("10.00"),
                new BigDecimal("390.00"),
                "EUR",
                2, 6,
                "15:00", "11:00",
                violations
        );

        assertTrue(dto.available());
        assertEquals(10L, dto.propertyId());
        assertEquals("Villa Sun", dto.propertyName());
        assertEquals(checkIn, dto.checkIn());
        assertEquals(checkOut, dto.checkOut());
        assertEquals(2, dto.guests());
        assertEquals(3, dto.nights());
        assertEquals(breakdown, dto.breakdown());
        assertEquals(new BigDecimal("330.00"), dto.subtotal());
        assertEquals(new BigDecimal("50.00"), dto.cleaningFee());
        assertEquals(new BigDecimal("10.00"), dto.touristTax());
        assertEquals(new BigDecimal("390.00"), dto.total());
        assertEquals("EUR", dto.currency());
        assertEquals(2, dto.minStay());
        assertEquals(6, dto.maxGuests());
        assertEquals("15:00", dto.checkInTime());
        assertEquals("11:00", dto.checkOutTime());
        assertEquals(violations, dto.violations());
    }

    @Test
    void nightBreakdown_accessorsReturnConstructorValues() {
        LocalDate date = LocalDate.of(2026, 7, 1);
        AvailabilityResponseDto.NightBreakdown nb =
                new AvailabilityResponseDto.NightBreakdown(date, new BigDecimal("99.99"), "LAST_MINUTE");

        assertEquals(date, nb.date());
        assertEquals(new BigDecimal("99.99"), nb.price());
        assertEquals("LAST_MINUTE", nb.rateType());
    }

    @Test
    void unavailable_factory_returnsNotAvailableWithZeros() {
        LocalDate checkIn = LocalDate.of(2026, 6, 1);
        LocalDate checkOut = LocalDate.of(2026, 6, 5);
        List<String> violations = List.of("MIN_STAY_NOT_MET");

        AvailabilityResponseDto dto = AvailabilityResponseDto.unavailable(
                10L, checkIn, checkOut, 4, violations);

        assertFalse(dto.available());
        assertEquals(10L, dto.propertyId());
        assertNull(dto.propertyName());
        assertEquals(checkIn, dto.checkIn());
        assertEquals(checkOut, dto.checkOut());
        assertEquals(4, dto.guests());
        assertEquals(0, dto.nights());
        assertNotNull(dto.breakdown());
        assertTrue(dto.breakdown().isEmpty());
        assertEquals(BigDecimal.ZERO, dto.subtotal());
        assertEquals(BigDecimal.ZERO, dto.cleaningFee());
        assertEquals(BigDecimal.ZERO, dto.touristTax());
        assertEquals(BigDecimal.ZERO, dto.total());
        assertNull(dto.currency());
        assertNull(dto.minStay());
        assertNull(dto.maxGuests());
        assertNull(dto.checkInTime());
        assertNull(dto.checkOutTime());
        assertEquals(violations, dto.violations());
    }
}
