package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.InterventionMapper;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationPaymentService;
import com.clenzy.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour ReservationController.update().
 *
 * Depuis le refactor T-ARCH-02, le controller ne fait plus que :
 * validation d'acces (ownership) + delegation a ReservationService.update()
 * + mapping DTO. L'orchestration (calendrier, intervention, codes serrure,
 * notification) est testee dans ReservationServiceUpdateTest.
 *
 * Depuis le refactor T-ARCH-01, le controller n'injecte plus aucun repository :
 * chargement (getByIdFetchAll), validation d'acces (validatePropertyAccess) et
 * rechargement (reloadWithRelations) passent par ReservationService — la
 * logique correspondante est testee dans ReservationServiceTest.
 */
@ExtendWith(MockitoExtension.class)
class ReservationControllerUpdateTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private ReservationPaymentService reservationPaymentService;
    @Mock private InterventionMapper interventionMapper;
    // Conserves uniquement pour les assertions "le controller n'ecrit plus en direct"
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;

    private ReservationController controller;

    @BeforeEach
    void setUp() {
        controller = new ReservationController(
                reservationService, reservationMapper,
                reservationPaymentService, interventionMapper);
    }

    private Jwt createJwt(String sub) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", sub)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private Property createProperty(String ownerKeycloakId) {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(1L);
        User owner = new User();
        owner.setId(1L);
        owner.setKeycloakId(ownerKeycloakId);
        property.setOwner(owner);
        return property;
    }

    private Reservation createReservation(Property property) {
        Reservation r = new Reservation();
        r.setId(1L);
        r.setProperty(property);
        r.setSource("direct");
        r.setCheckIn(LocalDate.of(2026, 3, 1));
        r.setCheckOut(LocalDate.of(2026, 3, 5));
        r.setStatus("confirmed");
        r.setGuestName("Test Guest");
        r.setOrganizationId(1L);
        return r;
    }

    private ReservationDto makeUpdateDto(String checkIn, String checkOut) {
        return new ReservationDto(null, null, null, null, null, null, null, null,
                checkIn, checkOut, null, null, null, null, null, null, null, null,
                null, null, null, null, null, false, null, null, null);
    }

    @Nested
    @DisplayName("update - delegation")
    class UpdateDelegation {

        @Test
        @DisplayName("delegue l'orchestration au service avec l'acteur JWT")
        void whenValid_thenDelegatesToService() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property);

            when(reservationService.getByIdFetchAll(1L)).thenReturn(reservation);

            ReservationDto dto = makeUpdateDto(null, "2026-03-08");
            when(reservationService.update(1L, dto, "user-1")).thenReturn(reservation);
            when(reservationService.reloadWithRelations(reservation)).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-08", null, null, "confirmed", "direct",
                            null, null, null, null, null, null, null, null, null, false, null, null, null));

            ResponseEntity<ReservationDto> response = controller.update(1L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(reservationService).update(1L, dto, "user-1");
            // Le controller ne fait plus d'ecritures directes
            verify(reservationRepository, never()).save(any(Reservation.class));
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("reservation non trouvee → NotFoundException, pas de delegation")
        void whenNotFound_thenThrows() {
            Jwt jwt = createJwt("user-1");
            when(reservationService.getByIdFetchAll(99L))
                    .thenThrow(new NotFoundException("Reservation non trouvee: 99"));

            assertThatThrownBy(() -> controller.update(99L, makeUpdateDto(null, "2026-03-08"), jwt))
                    .isInstanceOf(NotFoundException.class);
            verify(reservationService, never()).update(anyLong(), any(), anyString());
        }

        @Test
        @DisplayName("non proprietaire → AccessDenied, pas de delegation")
        void whenNotOwner_thenAccessDenied() {
            Jwt jwt = createJwt("intruder");
            Property property = createProperty("real-owner");
            Reservation reservation = createReservation(property);

            when(reservationService.getByIdFetchAll(1L)).thenReturn(reservation);
            doThrow(new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            assertThatThrownBy(() -> controller.update(1L, makeUpdateDto(null, "2026-03-08"), jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(reservationService, never()).update(anyLong(), any(), anyString());
        }

        @Test
        @DisplayName("conflit calendrier dans le service → propage (mappe en 409)")
        void whenServiceThrowsConflict_thenPropagates() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property);

            when(reservationService.getByIdFetchAll(1L)).thenReturn(reservation);

            ReservationDto dto = makeUpdateDto("2026-04-01", "2026-04-05");
            when(reservationService.update(1L, dto, "user-1"))
                    .thenThrow(new CalendarConflictException(1L,
                            LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 5), 2));

            assertThatThrownBy(() -> controller.update(1L, dto, jwt))
                    .isInstanceOf(CalendarConflictException.class);
        }
    }
}
