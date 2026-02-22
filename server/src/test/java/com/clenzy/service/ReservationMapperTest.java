package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link ReservationMapper}.
 * Validates Entity→DTO (toDto) and DTO→Entity (apply) mapping.
 */
@ExtendWith(MockitoExtension.class)
class ReservationMapperTest {

    @Mock
    private PropertyRepository propertyRepository;

    private ReservationMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ReservationMapper(propertyRepository);
    }

    private Reservation createReservation() {
        Reservation r = new Reservation();
        r.setId(1L);
        r.setGuestName("John Doe");
        r.setGuestCount(2);
        r.setCheckIn(LocalDate.of(2026, 3, 1));
        r.setCheckOut(LocalDate.of(2026, 3, 5));
        r.setCheckInTime("15:00");
        r.setCheckOutTime("11:00");
        r.setStatus("confirmed");
        r.setSource("airbnb");
        r.setSourceName("Airbnb");
        r.setTotalPrice(BigDecimal.valueOf(450.00));
        r.setConfirmationCode("HMABCDEF");
        r.setNotes("Late check-in");
        return r;
    }

    private Property createProperty(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    @Nested
    @DisplayName("toDto - Entity to DTO")
    class ToDto {

        @Test
        void whenFullReservation_thenMapsAllFields() {
            Reservation r = createReservation();
            Property property = createProperty(5L, "Appt Nice");
            r.setProperty(property);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.propertyId()).isEqualTo(5L);
            assertThat(dto.propertyName()).isEqualTo("Appt Nice");
            assertThat(dto.guestName()).isEqualTo("John Doe");
            assertThat(dto.guestCount()).isEqualTo(2);
            assertThat(dto.checkIn()).isEqualTo("2026-03-01");
            assertThat(dto.checkOut()).isEqualTo("2026-03-05");
            assertThat(dto.checkInTime()).isEqualTo("15:00");
            assertThat(dto.checkOutTime()).isEqualTo("11:00");
            assertThat(dto.status()).isEqualTo("confirmed");
            assertThat(dto.source()).isEqualTo("airbnb");
            assertThat(dto.sourceName()).isEqualTo("Airbnb");
            assertThat(dto.totalPrice()).isEqualTo(450.0);
            assertThat(dto.confirmationCode()).isEqualTo("HMABCDEF");
            assertThat(dto.notes()).isEqualTo("Late check-in");
        }

        @Test
        void whenNullProperty_thenPropertyFieldsAreDefaulted() {
            Reservation r = createReservation();
            r.setProperty(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.propertyId()).isNull();
            assertThat(dto.propertyName()).isEmpty();
        }

        @Test
        void whenNullGuestName_thenEmptyString() {
            Reservation r = createReservation();
            r.setProperty(createProperty(1L, "Test"));
            r.setGuestName(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.guestName()).isEmpty();
        }

        @Test
        void whenNullGuestCount_thenDefaultsTo1() {
            Reservation r = createReservation();
            r.setProperty(createProperty(1L, "Test"));
            r.setGuestCount(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.guestCount()).isEqualTo(1);
        }

        @Test
        void whenNullCheckIn_thenNullString() {
            Reservation r = createReservation();
            r.setProperty(createProperty(1L, "Test"));
            r.setCheckIn(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.checkIn()).isNull();
        }

        @Test
        void whenNullTimes_thenDefaultValues() {
            Reservation r = createReservation();
            r.setProperty(createProperty(1L, "Test"));
            r.setCheckInTime(null);
            r.setCheckOutTime(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.checkInTime()).isEqualTo("15:00");
            assertThat(dto.checkOutTime()).isEqualTo("11:00");
        }

        @Test
        void whenNullTotalPrice_thenDefaultsToZero() {
            Reservation r = createReservation();
            r.setProperty(createProperty(1L, "Test"));
            r.setTotalPrice(null);

            ReservationDto dto = mapper.toDto(r);

            assertThat(dto.totalPrice()).isEqualTo(0.0);
        }
    }

    @Nested
    @DisplayName("apply - DTO to Entity")
    class Apply {

        @Test
        void whenAllFieldsProvided_thenAppliesAll() {
            ReservationDto dto = new ReservationDto(
                    null, null, null,
                    "Jane Smith", 3,
                    "2026-04-01", "2026-04-05",
                    "14:00", "10:00",
                    null, null, null,
                    200.0, "CONF123", "VIP guest"
            );

            Reservation entity = new Reservation();
            entity.setProperty(createProperty(1L, "Test")); // Already has a property
            mapper.apply(dto, entity);

            assertThat(entity.getGuestName()).isEqualTo("Jane Smith");
            assertThat(entity.getGuestCount()).isEqualTo(3);
            assertThat(entity.getCheckIn()).isEqualTo(LocalDate.of(2026, 4, 1));
            assertThat(entity.getCheckOut()).isEqualTo(LocalDate.of(2026, 4, 5));
            assertThat(entity.getCheckInTime()).isEqualTo("14:00");
            assertThat(entity.getCheckOutTime()).isEqualTo("10:00");
            assertThat(entity.getTotalPrice()).isEqualByComparingTo("200.0");
            assertThat(entity.getConfirmationCode()).isEqualTo("CONF123");
            assertThat(entity.getNotes()).isEqualTo("VIP guest");
        }

        @Test
        void whenPropertyIdProvidedAndNoExistingProperty_thenSetsProperty() {
            Property property = createProperty(7L, "Villa");
            when(propertyRepository.findById(7L)).thenReturn(Optional.of(property));

            ReservationDto dto = new ReservationDto(
                    null, 7L, null,
                    null, null, null, null,
                    null, null, null, null, null,
                    null, null, null
            );

            Reservation entity = new Reservation();
            mapper.apply(dto, entity);

            assertThat(entity.getProperty()).isEqualTo(property);
        }

        @Test
        void whenPropertyNotFound_thenThrowsRuntime() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            ReservationDto dto = new ReservationDto(
                    null, 999L, null,
                    null, null, null, null,
                    null, null, null, null, null,
                    null, null, null
            );

            Reservation entity = new Reservation();

            assertThatThrownBy(() -> mapper.apply(dto, entity))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        void whenNullFieldsInDto_thenDoesNotOverwrite() {
            ReservationDto dto = new ReservationDto(
                    null, null, null,
                    null, null, null, null,
                    null, null, null, null, null,
                    null, null, null
            );

            Reservation entity = createReservation();
            entity.setProperty(createProperty(1L, "Test"));
            mapper.apply(dto, entity);

            // Original values should be preserved
            assertThat(entity.getGuestName()).isEqualTo("John Doe");
        }
    }
}
