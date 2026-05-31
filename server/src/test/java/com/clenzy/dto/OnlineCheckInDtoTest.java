package com.clenzy.dto;

import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.OnlineCheckInStatus;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class OnlineCheckInDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        LocalDateTime started = LocalDateTime.of(2026, 5, 1, 10, 0);
        LocalDateTime completed = LocalDateTime.of(2026, 5, 1, 10, 30);
        LocalDateTime expires = LocalDateTime.of(2026, 5, 8, 23, 59);

        OnlineCheckInDto dto = new OnlineCheckInDto(
            1L, 42L, "token-uuid", OnlineCheckInStatus.COMPLETED,
            "Jean", "Dupont", "14:00", 3,
            started, completed, expires,
            "https://app.clenzy.fr/check-in/token-uuid"
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.reservationId());
        assertEquals("token-uuid", dto.token());
        assertEquals(OnlineCheckInStatus.COMPLETED, dto.status());
        assertEquals("Jean", dto.firstName());
        assertEquals("Dupont", dto.lastName());
        assertEquals("14:00", dto.estimatedArrivalTime());
        assertEquals(3, dto.numberOfGuests());
        assertEquals(started, dto.startedAt());
        assertEquals(completed, dto.completedAt());
        assertEquals(expires, dto.expiresAt());
        assertEquals("https://app.clenzy.fr/check-in/token-uuid", dto.checkInLink());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        Reservation reservation = new Reservation();
        reservation.setId(99L);

        UUID token = UUID.fromString("11111111-2222-3333-4444-555555555555");
        LocalDateTime started = LocalDateTime.of(2026, 6, 1, 8, 0);
        LocalDateTime completed = LocalDateTime.of(2026, 6, 1, 8, 15);
        LocalDateTime expires = LocalDateTime.of(2026, 6, 8, 23, 59);

        OnlineCheckIn entity = new OnlineCheckIn();
        entity.setId(7L);
        entity.setReservation(reservation);
        entity.setToken(token);
        entity.setStatus(OnlineCheckInStatus.STARTED);
        entity.setFirstName("Marie");
        entity.setLastName("Curie");
        entity.setEstimatedArrivalTime("16:30");
        entity.setNumberOfGuests(2);
        entity.setStartedAt(started);
        entity.setCompletedAt(completed);
        entity.setExpiresAt(expires);

        String checkInLink = "https://example.com/check-in/" + token;
        OnlineCheckInDto dto = OnlineCheckInDto.from(entity, checkInLink);

        assertEquals(7L, dto.id());
        assertEquals(99L, dto.reservationId());
        assertEquals(token.toString(), dto.token());
        assertEquals(OnlineCheckInStatus.STARTED, dto.status());
        assertEquals("Marie", dto.firstName());
        assertEquals("Curie", dto.lastName());
        assertEquals("16:30", dto.estimatedArrivalTime());
        assertEquals(2, dto.numberOfGuests());
        assertEquals(started, dto.startedAt());
        assertEquals(completed, dto.completedAt());
        assertEquals(expires, dto.expiresAt());
        assertEquals(checkInLink, dto.checkInLink());
    }

    @Test
    void from_defaultEntityStatus_isPending() {
        Reservation reservation = new Reservation();
        reservation.setId(1L);

        OnlineCheckIn entity = new OnlineCheckIn();
        entity.setReservation(reservation);
        entity.setExpiresAt(LocalDateTime.of(2026, 12, 31, 23, 59));

        OnlineCheckInDto dto = OnlineCheckInDto.from(entity, "link");

        assertEquals(OnlineCheckInStatus.PENDING, dto.status()); // entity default
        // SECURITY: ce DTO ne contient PAS email, phone, ni idDocumentNumber.
        // C'est intentionnel (champs chiffres, jamais exposes via from()).
    }

    @Test
    void from_tokenIsGeneratedUuid_whenNotExplicitlySet() {
        Reservation reservation = new Reservation();
        reservation.setId(2L);

        OnlineCheckIn entity = new OnlineCheckIn();
        entity.setReservation(reservation);
        entity.setExpiresAt(LocalDateTime.of(2026, 12, 31, 23, 59));

        OnlineCheckInDto dto = OnlineCheckInDto.from(entity, "link");

        assertNotNull(dto.token());
        // UUID.toString() format = 8-4-4-4-12 hex chars
        assertDoesNotThrow(() -> UUID.fromString(dto.token()));
    }

    @Test
    void record_equalityByValue() {
        OnlineCheckInDto a = new OnlineCheckInDto(
            1L, 1L, "t", OnlineCheckInStatus.PENDING,
            null, null, null, null, null, null, null, "l");
        OnlineCheckInDto b = new OnlineCheckInDto(
            1L, 1L, "t", OnlineCheckInStatus.PENDING,
            null, null, null, null, null, null, null, "l");
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
