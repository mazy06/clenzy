package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationControllerTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private ReservationController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private ReservationDto sampleDto(String status) {
        return new ReservationDto(1L, 1L, "Apt A", "Jean", 2, "2026-03-01", "2026-03-04",
                "14:00", "11:00", status, "direct", null, 150.0, "ABC123", "notes");
    }

    private Property createOwnedProperty(String ownerKeycloakId) {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(1L);
        User owner = new User();
        owner.setKeycloakId(ownerKeycloakId);
        property.setOwner(owner);
        return property;
    }

    @BeforeEach
    void setUp() {
        controller = new ReservationController(reservationService, reservationMapper,
                reservationRepository, propertyRepository, userRepository, tenantContext);
    }

    @Nested
    @DisplayName("getReservations")
    class GetReservations {
        @Test
        void whenGetAll_thenReturnsFiltered() {
            Jwt jwt = createJwt();
            Reservation reservation = new Reservation();
            reservation.setStatus("confirmed");
            when(reservationService.getReservations(eq("user-123"), isNull(), any(), any()))
                    .thenReturn(List.of(reservation));
            when(reservationMapper.toDto(reservation)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, null, null, null);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenStatusFilter_thenFilters() {
            Jwt jwt = createJwt();
            Reservation r1 = new Reservation();
            r1.setStatus("confirmed");
            Reservation r2 = new Reservation();
            r2.setStatus("cancelled");
            when(reservationService.getReservations(eq("user-123"), isNull(), any(), any()))
                    .thenReturn(List.of(r1, r2));
            when(reservationMapper.toDto(r1)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, null, null, "confirmed");
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenGetByProperty_thenDelegates() {
            Reservation reservation = new Reservation();
            when(reservationService.getByProperty(1L)).thenReturn(List.of(reservation));
            when(reservationMapper.toDto(reservation)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<List<ReservationDto>> response = controller.getByProperty(1L);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void whenExists_thenReturnsDto() {
            Reservation reservation = new Reservation();
            when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
            when(reservationMapper.toDto(reservation)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<ReservationDto> response = controller.getById(1L);
            assertThat(response.getBody().propertyName()).isEqualTo("Apt A");
        }

        @Test
        void whenNotFound_thenThrows() {
            when(reservationRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getById(1L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenOwnerCreates_thenReturnsOk() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            Reservation saved = new Reservation();
            when(reservationService.save(any(Reservation.class))).thenReturn(saved);
            when(reservationMapper.toDto(saved)).thenReturn(sampleDto("confirmed"));

            ReservationDto inputDto = new ReservationDto(null, 1L, null, "Guest", 2,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null);
            ResponseEntity<ReservationDto> response = controller.create(inputDto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("cancel")
    class Cancel {
        @Test
        void whenOwnerCancels_thenDelegates() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setProperty(property);
            when(reservationRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);

            Reservation cancelled = new Reservation();
            when(reservationService.cancel(1L)).thenReturn(cancelled);
            when(reservationMapper.toDto(cancelled)).thenReturn(sampleDto("cancelled"));

            ResponseEntity<ReservationDto> response = controller.cancel(1L, jwt);
            assertThat(response.getBody().status()).isEqualTo("cancelled");
        }
    }
}
