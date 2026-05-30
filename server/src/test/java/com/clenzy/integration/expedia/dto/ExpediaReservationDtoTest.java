package com.clenzy.integration.expedia.dto;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class ExpediaReservationDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        LocalDate checkIn = LocalDate.of(2026, 6, 1);
        LocalDate checkOut = LocalDate.of(2026, 6, 5);

        ExpediaReservationDto dto = new ExpediaReservationDto(
                "RES-123",
                "PROP-10",
                "ROOM-A",
                "Jane",
                "Doe",
                "jane@example.com",
                checkIn,
                checkOut,
                "CONFIRMED",
                new BigDecimal("450.00"),
                "EUR",
                2,
                1,
                "Late check-in please",
                "VRBO"
        );

        assertEquals("RES-123", dto.reservationId());
        assertEquals("PROP-10", dto.propertyId());
        assertEquals("ROOM-A", dto.roomId());
        assertEquals("Jane", dto.guestFirstName());
        assertEquals("Doe", dto.guestLastName());
        assertEquals("jane@example.com", dto.guestEmail());
        assertEquals(checkIn, dto.checkIn());
        assertEquals(checkOut, dto.checkOut());
        assertEquals("CONFIRMED", dto.status());
        assertEquals(new BigDecimal("450.00"), dto.totalAmount());
        assertEquals("EUR", dto.currency());
        assertEquals(2, dto.numberOfAdults());
        assertEquals(1, dto.numberOfChildren());
        assertEquals("Late check-in please", dto.specialRequests());
        assertEquals("VRBO", dto.source());
    }

    @Test
    void guestFullName_concatenatesFirstAndLast() {
        ExpediaReservationDto dto = build("Alice", "Wonder");
        assertEquals("Alice Wonder", dto.guestFullName());
    }

    @Test
    void guestFullName_bothNull_returnsNull() {
        ExpediaReservationDto dto = build(null, null);
        assertNull(dto.guestFullName());
    }

    @Test
    void guestFullName_onlyFirst_returnsFirst() {
        ExpediaReservationDto dto = build("Alice", null);
        assertEquals("Alice", dto.guestFullName());
    }

    @Test
    void guestFullName_onlyLast_returnsLast() {
        ExpediaReservationDto dto = build(null, "Wonder");
        assertEquals("Wonder", dto.guestFullName());
    }

    @Test
    void totalGuests_sumsAdultsAndChildren() {
        ExpediaReservationDto dto = new ExpediaReservationDto(
                "id", "p", "r", "A", "B", "e@e", null, null, "CONFIRMED",
                BigDecimal.ZERO, "EUR", 3, 2, null, "EXPEDIA"
        );
        assertEquals(5, dto.totalGuests());
    }

    @Test
    void totalGuests_zeroChildren_returnsAdults() {
        ExpediaReservationDto dto = new ExpediaReservationDto(
                "id", "p", "r", "A", "B", "e@e", null, null, "CONFIRMED",
                BigDecimal.ZERO, "EUR", 2, 0, null, "HOTELS_COM"
        );
        assertEquals(2, dto.totalGuests());
    }

    private ExpediaReservationDto build(String first, String last) {
        return new ExpediaReservationDto(
                "RES", "PROP", "ROOM",
                first, last, "g@e",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2),
                "CONFIRMED", BigDecimal.TEN, "EUR",
                1, 0, null, "EXPEDIA"
        );
    }
}
