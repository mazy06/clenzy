package com.clenzy.controller;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.InterventionMapper;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationControllerTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private com.clenzy.service.GuestService guestService;
    @Mock private StripeService stripeService;
    @Mock private EmailService emailService;
    @Mock private com.clenzy.service.messaging.GuestMessagingService guestMessagingService;
    @Mock private MessageTemplateRepository messageTemplateRepository;
    @Mock private InterventionMapper interventionMapper;
    @Mock private TenantContext tenantContext;
    @Mock private com.clenzy.repository.SmartLockDeviceRepository smartLockDeviceRepository;
    @Mock private com.clenzy.service.smartlock.SmartLockAccessCodeService accessCodeService;

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
        return new ReservationDto(1L, 1L, "Apt A", "Jean", null, null, null, 2, "2026-03-01", "2026-03-04",
                "14:00", "11:00", status, "direct", null, 150.0, "ABC123", "notes",
                null, null, null, null, null, false, null, null, null);
    }

    private Property createOwnedProperty(String ownerKeycloakId) {
        Property property = new Property();
        property.setId(1L);
        property.setOrganizationId(1L);
        User owner = new User();
        owner.setId(1L);
        owner.setKeycloakId(ownerKeycloakId);
        property.setOwner(owner);
        return property;
    }

    @BeforeEach
    void setUp() {
        controller = new ReservationController(reservationService, reservationMapper,
                reservationRepository, interventionRepository, propertyRepository, userRepository, guestRepository,
                guestService, stripeService, emailService, guestMessagingService, messageTemplateRepository,
                interventionMapper, tenantContext, smartLockDeviceRepository, accessCodeService);
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

        @Test
        void whenStatusAll_thenNoFilter() {
            Jwt jwt = createJwt();
            Reservation r1 = new Reservation();
            r1.setStatus("confirmed");
            Reservation r2 = new Reservation();
            r2.setStatus("cancelled");
            when(reservationService.getReservations(any(), any(), any(), any()))
                    .thenReturn(List.of(r1, r2));
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("any"));

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, null, null, "all");
            assertThat(response.getBody()).hasSize(2);
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
            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            when(reservationMapper.toDto(reservation)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<ReservationDto> response = controller.getById(1L);
            assertThat(response.getBody().propertyName()).isEqualTo("Apt A");
        }

        @Test
        void whenNotFound_thenThrows() {
            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getById(1L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getLinkedInterventions")
    class GetLinkedInterventions {
        @Test
        void whenInterventionsExist_thenReturnsList() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            com.clenzy.model.Intervention intervention = new com.clenzy.model.Intervention();
            when(interventionRepository.findByReservationId(1L, 1L)).thenReturn(List.of(intervention));
            InterventionResponse response = InterventionResponse.builder().id(1L).build();
            when(interventionMapper.convertToResponse(intervention)).thenReturn(response);

            ResponseEntity<List<InterventionResponse>> result = controller.getLinkedInterventions(1L);

            assertThat(result.getBody()).hasSize(1);
        }

        @Test
        void whenNoInterventions_thenReturnsEmpty() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByReservationId(1L, 1L)).thenReturn(List.of());

            ResponseEntity<List<InterventionResponse>> result = controller.getLinkedInterventions(1L);

            assertThat(result.getBody()).isEmpty();
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
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            Reservation saved = new Reservation();
            saved.setId(99L);
            when(reservationService.save(any(Reservation.class))).thenReturn(saved);
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.of(saved));
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto inputDto = new ReservationDto(null, 1L, null, "Guest", null, null, null, 2,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);
            ResponseEntity<ReservationDto> response = controller.create(inputDto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenPropertyNotInOrg_thenAccessDenied() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            property.setOrganizationId(99L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenUserNotOwner_thenAccessDenied() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("other-user");
            User caller = new User();
            caller.setId(99L);
            caller.setKeycloakId("user-123");
            caller.setRole(com.clenzy.model.UserRole.HOST);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(caller));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenPropertyNotFound_thenNotFound() {
            Jwt jwt = createJwt();
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            ReservationDto dto = new ReservationDto(null, 99L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenSuperAdmin_thenBypassOwnership() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("other");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(true);

            Reservation saved = new Reservation();
            saved.setId(10L);
            when(reservationService.save(any())).thenReturn(saved);
            when(reservationRepository.findByIdFetchAll(10L)).thenReturn(Optional.of(saved));
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);
            ResponseEntity<ReservationDto> response = controller.create(dto, jwt);
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
            Reservation cancelled = new Reservation();
            when(reservationRepository.findByIdFetchAll(1L))
                    .thenReturn(Optional.of(existing))
                    .thenReturn(Optional.of(cancelled));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            when(reservationService.cancel(1L)).thenReturn(cancelled);
            when(reservationMapper.toDto(cancelled)).thenReturn(sampleDto("cancelled"));

            ResponseEntity<ReservationDto> response = controller.cancel(1L, jwt);
            assertThat(response.getBody().status()).isEqualTo("cancelled");
        }

        @Test
        void whenReservationNotFound_thenNotFound() {
            Jwt jwt = createJwt();
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.cancel(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("hideFromPlanning")
    class HideFromPlanning {
        @Test
        void whenCancelled_thenHidesAndReturnsDto() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setProperty(property);
            existing.setStatus("cancelled");
            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));
            when(reservationRepository.save(existing)).thenReturn(existing);
            when(reservationMapper.toDto(existing)).thenReturn(sampleDto("cancelled"));

            ResponseEntity<ReservationDto> response = controller.hideFromPlanning(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(existing.getHiddenFromPlanning()).isTrue();
        }

        @Test
        void whenNotCancelled_thenBadRequest() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setProperty(property);
            existing.setStatus("confirmed");
            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            ResponseEntity<ReservationDto> response = controller.hideFromPlanning(1L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(reservationRepository, never()).save(any());
        }
    }

    // ============= EXTENDED =============

    @Nested
    @DisplayName("update")
    class UpdateReservation {
        @Test
        void whenReservationNotFound_thenNotFound() {
            Jwt jwt = createJwt();
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            ReservationDto dto = sampleDto("confirmed");
            assertThatThrownBy(() -> controller.update(99L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenUpdated_thenReturnsDto() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setId(1L);
            existing.setProperty(property);
            existing.setCheckOut(java.time.LocalDate.of(2026, 3, 4));

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));
            when(reservationRepository.save(existing)).thenReturn(existing);
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = sampleDto("confirmed");
            ResponseEntity<ReservationDto> response = controller.update(1L, dto, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(reservationService).notifyReservationUpdated(any());
        }
    }

    @Nested
    @DisplayName("getReservations - filters defaults")
    class GetReservationsFilters {
        @Test
        void whenFromIsNull_thenUsesDefaultStart() {
            Jwt jwt = createJwt();
            when(reservationService.getReservations(eq("user-123"), isNull(), any(), any()))
                    .thenReturn(List.of());

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(
                    jwt, null, null, null, null);
            assertThat(response.getBody()).isEmpty();
        }
    }

    @Nested
    @DisplayName("create - guest validation")
    class CreateWithGuest {
        @Test
        void whenGuestIdNotFound_thenNotFound() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(guestRepository.findByIdAndOrganizationId(50L, 1L)).thenReturn(Optional.empty());

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", 50L, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("sendPaymentLink")
    class SendPaymentLink {
        @Test
        void whenReservationNotFound_thenNotFound() {
            Jwt jwt = createJwt();
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.sendPaymentLink(99L, java.util.Map.of(), jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenNoEmailProvidedNoGuestEmail_thenIllegalArgument() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation r = new Reservation();
            r.setProperty(property);
            r.setTotalPrice(new java.math.BigDecimal("100"));

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(r));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            assertThatThrownBy(() -> controller.sendPaymentLink(1L, java.util.Map.of(), jwt))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenAmountZero_thenIllegalArgument() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation r = new Reservation();
            r.setProperty(property);
            r.setTotalPrice(java.math.BigDecimal.ZERO);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(r));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            assertThatThrownBy(() -> controller.sendPaymentLink(1L, java.util.Map.of("email", "x@y.z"), jwt))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("checkPaymentStatus")
    class CheckPaymentStatus {
        @Test
        void whenReservationNotFound_thenReturns404() {
            Jwt jwt = createJwt();
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            ResponseEntity<?> result = controller.checkPaymentStatus(99L, jwt);
            assertThat(result.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenAlreadyPaid_thenReturnsPaidStatus() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation r = new Reservation();
            r.setProperty(property);
            r.setPaymentStatus(com.clenzy.model.PaymentStatus.PAID);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(r));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            ResponseEntity<?> result = controller.checkPaymentStatus(1L, jwt);
            assertThat(result.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNoStripeSession_thenReturnsNoSession() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation r = new Reservation();
            r.setProperty(property);
            r.setPaymentStatus(com.clenzy.model.PaymentStatus.PROCESSING);
            r.setStripeSessionId("  ");

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(r));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            ResponseEntity<?> result = controller.checkPaymentStatus(1L, jwt);
            assertThat(result.getStatusCode().value()).isEqualTo(200);
        }
    }

    // ============= EXTENDED v2 =============

    @Nested
    @DisplayName("getReservations - filter combinations")
    class GetReservationsExt {
        @Test
        void whenStatusEmpty_thenNoFilter() {
            Jwt jwt = createJwt();
            Reservation r1 = new Reservation();
            r1.setStatus("confirmed");
            when(reservationService.getReservations(any(), any(), any(), any()))
                    .thenReturn(List.of(r1));
            when(reservationMapper.toDto(r1)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, null, null, "");
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenStatusFilterCaseInsensitive_thenMatches() {
            Jwt jwt = createJwt();
            Reservation r1 = new Reservation();
            r1.setStatus("CONFIRMED");
            when(reservationService.getReservations(any(), any(), any(), any()))
                    .thenReturn(List.of(r1));
            when(reservationMapper.toDto(r1)).thenReturn(sampleDto("CONFIRMED"));

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, null, null, "confirmed");
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenFromAndToProvided_thenUsedAsIs() {
            Jwt jwt = createJwt();
            java.time.LocalDate from = java.time.LocalDate.of(2026, 1, 1);
            java.time.LocalDate to = java.time.LocalDate.of(2026, 12, 31);
            when(reservationService.getReservations(eq("user-123"), isNull(), eq(from), eq(to)))
                    .thenReturn(List.of());

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(jwt, null, from, to, null);
            assertThat(response.getBody()).isEmpty();
            verify(reservationService).getReservations("user-123", null, from, to);
        }

        @Test
        void whenPropertyIdsProvided_thenPassedThrough() {
            Jwt jwt = createJwt();
            when(reservationService.getReservations(eq("user-123"), eq(List.of(1L, 2L)), any(), any()))
                    .thenReturn(List.of());

            ResponseEntity<List<ReservationDto>> response = controller.getReservations(
                    jwt, List.of(1L, 2L), null, null, null);
            assertThat(response.getBody()).isEmpty();
            verify(reservationService).getReservations(eq("user-123"), eq(List.of(1L, 2L)), any(), any());
        }
    }

    @Nested
    @DisplayName("validatePropertyAccess via cancel")
    class ValidatePropertyAccess {
        @Test
        void whenPropertyOrgIdNull_thenAllowsAccess() {
            // OrgId null is treated as "not set" -- ownership still checked
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            property.setOrganizationId(null);
            Reservation existing = new Reservation();
            existing.setProperty(property);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing))
                    .thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));
            when(reservationService.cancel(1L)).thenReturn(existing);
            when(reservationMapper.toDto(existing)).thenReturn(sampleDto("cancelled"));

            ResponseEntity<ReservationDto> response = controller.cancel(1L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenPlatformStaffRole_thenBypassesOwnership() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("someone-else");
            Reservation existing = new Reservation();
            existing.setProperty(property);
            User caller = new User();
            caller.setId(99L);
            caller.setKeycloakId("user-123");
            caller.setRole(com.clenzy.model.UserRole.SUPER_MANAGER);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing))
                    .thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(caller));
            when(reservationService.cancel(1L)).thenReturn(existing);
            when(reservationMapper.toDto(existing)).thenReturn(sampleDto("cancelled"));

            ResponseEntity<ReservationDto> response = controller.cancel(1L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("create - createCleaning flag")
    class CreateWithCleaning {
        @Test
        void whenCreateCleaningTrue_thenInvokesCleaning() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            Reservation saved = new Reservation();
            saved.setId(7L);
            when(reservationService.save(any())).thenReturn(saved);
            when(reservationRepository.findByIdFetchAll(7L)).thenReturn(Optional.of(saved));
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            // createCleaning is the 21st field (index 20)
            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, true, null, null, null, null, null, null);

            ResponseEntity<ReservationDto> response = controller.create(dto, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(reservationService).createCleaningForReservation(saved, "user-123");
        }

        @Test
        void whenCreateCleaningFalse_thenSkipsCleaning() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));

            Reservation saved = new Reservation();
            saved.setId(8L);
            when(reservationService.save(any())).thenReturn(saved);
            when(reservationRepository.findByIdFetchAll(8L)).thenReturn(Optional.of(saved));
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            controller.create(dto, jwt);
            verify(reservationService, never()).createCleaningForReservation(any(), any());
        }

        @Test
        void whenSavedReloadFails_thenFallsBackToSaved() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(true);

            Reservation saved = new Reservation();
            saved.setId(11L);
            when(reservationService.save(any())).thenReturn(saved);
            // Reload returns empty -- should fall back to the original `saved`
            when(reservationRepository.findByIdFetchAll(11L)).thenReturn(Optional.empty());
            when(reservationMapper.toDto(saved)).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-04", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            ResponseEntity<ReservationDto> response = controller.create(dto, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("update - intervention rescheduling")
    class UpdateIntervention {
        @Test
        void whenCheckOutChangedAndInterventionLinked_thenReschedulesIntervention() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setId(1L);
            existing.setProperty(property);
            existing.setCheckOut(java.time.LocalDate.of(2026, 3, 4));

            com.clenzy.model.Intervention intervention = new com.clenzy.model.Intervention();
            intervention.setId(50L);
            intervention.setScheduledDate(java.time.LocalDateTime.of(2026, 3, 4, 11, 0));
            intervention.setEstimatedDurationHours(2);
            existing.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));
            when(reservationRepository.save(existing)).thenAnswer(inv -> {
                // After mapper.apply changes the checkOut, save it
                existing.setCheckOut(java.time.LocalDate.of(2026, 3, 6));
                return existing;
            });
            // Mock the mapper to update checkOut field on existing
            org.mockito.Mockito.doAnswer(inv -> {
                existing.setCheckOut(java.time.LocalDate.of(2026, 3, 6));
                return null;
            }).when(reservationMapper).apply(any(), any());
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = new ReservationDto(null, 1L, null, "G", null, null, null, 1,
                    "2026-03-01", "2026-03-06", null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, null, null, null);

            controller.update(1L, dto, jwt);

            verify(interventionRepository).save(any(com.clenzy.model.Intervention.class));
        }

        @Test
        void whenGuestNullAndGuestNameSet_thenCreatesGuestBeforeApply() {
            Jwt jwt = createJwt();
            Property property = createOwnedProperty("user-123");
            Reservation existing = new Reservation();
            existing.setId(1L);
            existing.setProperty(property);
            existing.setGuestName("Anonymous");
            existing.setSource("ical");
            existing.setCheckOut(java.time.LocalDate.of(2026, 3, 4));

            com.clenzy.model.Guest guest = new com.clenzy.model.Guest();
            guest.setId(100L);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(property.getOwner()));
            when(guestService.findOrCreateFromName("Anonymous", "ical", 1L)).thenReturn(guest);
            when(reservationRepository.save(existing)).thenReturn(existing);
            when(reservationMapper.toDto(any())).thenReturn(sampleDto("confirmed"));

            ReservationDto dto = sampleDto("confirmed");
            controller.update(1L, dto, jwt);

            verify(guestService).findOrCreateFromName("Anonymous", "ical", 1L);
            assertThat(existing.getGuest()).isEqualTo(guest);
        }
    }

    @Nested
    @DisplayName("getById - LazyInitialization safety")
    class GetByIdNested {
        @Test
        void whenFound_thenDtoConverted() {
            Reservation r = new Reservation();
            r.setId(50L);
            when(reservationRepository.findByIdFetchAll(50L)).thenReturn(Optional.of(r));
            when(reservationMapper.toDto(r)).thenReturn(sampleDto("confirmed"));

            ResponseEntity<ReservationDto> response = controller.getById(50L);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo("confirmed");
        }
    }
}
