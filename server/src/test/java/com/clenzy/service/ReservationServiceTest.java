package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private UserRepository userRepository;
    @Mock private CalendarEngine calendarEngine;
    @Mock private GuestService guestService;
    @Mock private SyncMetrics syncMetrics;
    @Mock private com.clenzy.repository.ServiceRequestRepository serviceRequestRepository;
    @Mock private NotificationService notificationService;
    @Mock private MinNightsOverrideRepository minNightsOverrideRepository;
    @Mock private com.clenzy.service.messaging.AutomationEvaluationService automationEvaluationService;
    @Mock private com.clenzy.repository.SmartLockDeviceRepository smartLockDeviceRepository;
    @Mock private com.clenzy.service.smartlock.SmartLockAccessCodeService smartLockAccessCodeService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private com.clenzy.repository.InterventionRepository interventionRepository;
    @Mock private com.clenzy.repository.PropertyRepository propertyRepository;
    @Mock private com.clenzy.repository.GuestRepository guestRepository;
    @Mock private StripeService stripeService;

    private TenantContext tenantContext;
    private ReservationService reservationService;

    private Property property;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Long orgId;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        orgId = 1L;
        tenantContext.setOrganizationId(orgId);

        reservationService = new ReservationService(
                reservationRepository, userRepository, tenantContext,
                calendarEngine, guestService, syncMetrics,
                serviceRequestRepository, notificationService,
                minNightsOverrideRepository, automationEvaluationService,
                smartLockDeviceRepository, smartLockAccessCodeService,
                reservationMapper, interventionRepository,
                propertyRepository, guestRepository, stripeService
        );

        // Pas d'override min-nights par defaut dans les tests (resolution
        // tombe sur property.minimumNights, qui est null pour la plupart
        // des tests existants → pas de contrainte).
        lenient().when(minNightsOverrideRepository.findByPropertyIdAndDate(anyLong(), any(), anyLong()))
                .thenReturn(Optional.empty());

        property = new Property();
        property.setId(1L);

        checkIn = LocalDate.of(2025, 6, 1);
        checkOut = LocalDate.of(2025, 6, 5);

        lenient().when(syncMetrics.startTimer()).thenReturn(mock(Timer.Sample.class));
    }

    private User buildUser(Long id, String keycloakId, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setRole(role);
        return user;
    }

    @Nested
    @DisplayName("save - new confirmed reservation")
    class SaveNewConfirmed {

        @Test
        @DisplayName("should call CalendarEngine.book for new confirmed reservation")
        void whenNewConfirmed_thenCallsBook() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("AIRBNB");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(calendarEngine.book(eq(1L), eq(checkIn), eq(checkOut), isNull(), eq(orgId), eq("AIRBNB"), isNull()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(100L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            // Act
            reservationService.save(reservation);

            // Assert
            verify(calendarEngine).book(eq(1L), eq(checkIn), eq(checkOut), isNull(), eq(orgId), eq("AIRBNB"), isNull());
            verify(calendarEngine).linkReservation(eq(1L), eq(checkIn), eq(checkOut), eq(100L), eq(orgId));
        }

        @Test
        @DisplayName("should throw CalendarConflictException and increment metric on conflict")
        void whenConflict_thenThrowsAndIncrementsMetric() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                    .thenThrow(new CalendarConflictException(1L, checkIn, checkOut, 2));

            // Act & Assert
            assertThatThrownBy(() -> reservationService.save(reservation))
                    .isInstanceOf(CalendarConflictException.class);
            verify(syncMetrics).incrementDoubleBookingPrevented();
        }

        @Test
        @DisplayName("should link reservation after save")
        void whenSaved_thenLinksReservation() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(42L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            // Act
            reservationService.save(reservation);

            // Assert
            verify(calendarEngine).linkReservation(eq(1L), eq(checkIn), eq(checkOut), eq(42L), eq(orgId));
        }
    }

    @Nested
    @DisplayName("save - guest auto-creation")
    class SaveGuestAutoCreation {

        @Test
        @DisplayName("should auto-create guest when guestName is set and guest is null")
        void whenGuestNameProvided_thenCreatesGuest() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("AIRBNB");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);
            reservation.setGuestName("John Doe");

            Guest guest = new Guest();
            when(guestService.findOrCreateFromName("John Doe", "AIRBNB", orgId)).thenReturn(guest);
            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(100L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            // Act
            reservationService.save(reservation);

            // Assert
            verify(guestService).findOrCreateFromName("John Doe", "AIRBNB", orgId);
            assertThat(reservation.getGuest()).isEqualTo(guest);
        }

        @Test
        @DisplayName("should not create guest when guestName is blank")
        void whenGuestNameIsBlank_thenDoesNotCreateGuest() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);
            reservation.setGuestName("   ");

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(100L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            // Act
            reservationService.save(reservation);

            // Assert
            verifyNoInteractions(guestService);
        }

        @Test
        @DisplayName("should not override existing guest")
        void whenGuestAlreadySet_thenDoesNotCreateNew() {
            // Arrange
            Guest existingGuest = new Guest();
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);
            reservation.setGuestName("John Doe");
            reservation.setGuest(existingGuest);

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), anyString(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(100L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            // Act
            reservationService.save(reservation);

            // Assert
            verifyNoInteractions(guestService);
            assertThat(reservation.getGuest()).isEqualTo(existingGuest);
        }
    }

    @Nested
    @DisplayName("save - organization validation")
    class SaveOrgValidation {

        @Test
        @DisplayName("should reject cross-tenant reservation")
        void whenCrossTenant_thenThrows() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(2L); // Different from tenantContext

            // Act & Assert
            assertThatThrownBy(() -> reservationService.save(reservation))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("organisation");
            verify(reservationRepository, never()).save(any(Reservation.class));
        }

        @Test
        @DisplayName("should set organizationId when null")
        void whenOrgIdNull_thenSetsFromTenantContext() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(null);
            reservation.setStatus("pending");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(reservationRepository.save(reservation)).thenReturn(reservation);

            // Act
            reservationService.save(reservation);

            // Assert
            assertThat(reservation.getOrganizationId()).isEqualTo(orgId);
        }
    }

    @Nested
    @DisplayName("save - non-confirmed reservations")
    class SaveNonConfirmed {

        @Test
        @DisplayName("should not call CalendarEngine for pending reservations")
        void whenPendingStatus_thenSkipsCalendar() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("pending");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(reservationRepository.save(reservation)).thenReturn(reservation);

            // Act
            reservationService.save(reservation);

            // Assert
            verifyNoInteractions(calendarEngine);
        }

        @Test
        @DisplayName("should not call CalendarEngine for existing reservations (id not null)")
        void whenExistingReservation_thenSkipsCalendar() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setId(50L); // Existing
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(reservationRepository.save(reservation)).thenReturn(reservation);

            // Act
            reservationService.save(reservation);

            // Assert
            verifyNoInteractions(calendarEngine);
        }

        @Test
        @DisplayName("should record metrics with default source MANUAL when source is null")
        void whenSourceNull_thenUsesManualForMetrics() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource(null);
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), any(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(100L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            Timer.Sample sample = mock(Timer.Sample.class);
            when(syncMetrics.startTimer()).thenReturn(sample);

            // Act
            reservationService.save(reservation);

            // Assert
            verify(syncMetrics).recordReservationCreation(eq("MANUAL"), eq(sample));
        }
    }

    @Nested
    @DisplayName("cancel")
    class Cancel {

        @Test
        @DisplayName("should release calendar days and set status to cancelled")
        void whenCancelling_thenReleasesAndUpdatesStatus() {
            // Arrange
            Long reservationId = 100L;
            Reservation reservation = new Reservation();
            reservation.setId(reservationId);
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");

            when(reservationRepository.findById(reservationId)).thenReturn(Optional.of(reservation));
            when(calendarEngine.cancel(eq(reservationId), eq(orgId), isNull())).thenReturn(3);
            when(reservationRepository.save(reservation)).thenReturn(reservation);

            // Act
            Reservation result = reservationService.cancel(reservationId);

            // Assert
            verify(calendarEngine).cancel(eq(reservationId), eq(orgId), isNull());
            assertThat(result.getStatus()).isEqualTo("cancelled");
            verify(reservationRepository).save(reservation);
        }

        @Test
        @DisplayName("should throw when reservation not found")
        void whenNotFound_thenThrows() {
            // Arrange
            when(reservationRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> reservationService.cancel(999L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("should throw when reservation belongs to different organization")
        void whenCrossTenant_thenThrows() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(2L); // Different org

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));

            // Act & Assert
            assertThatThrownBy(() -> reservationService.cancel(100L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("organisation");
        }

        @Test
        @DisplayName("reliquat A3: cancelling a pending reservation with an open Stripe session expires it")
        void whenCancellingPendingWithStripeSession_thenExpiresSession() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(orgId);
            reservation.setStatus("pending");
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            reservation.setStripeSessionId("cs_open");

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
            when(reservationRepository.save(reservation)).thenReturn(reservation);
            when(stripeService.expireCheckoutSession("cs_open"))
                    .thenReturn(StripeService.CheckoutSessionExpiryResult.EXPIRED);

            // Act
            reservationService.cancel(100L);

            // Assert
            verify(stripeService).expireCheckoutSession("cs_open");
        }

        @Test
        @DisplayName("reliquat A3: session paid during cancellation race triggers automatic refund")
        void whenCancelledSessionAlreadyPaid_thenRefunds() throws Exception {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setId(101L);
            reservation.setOrganizationId(orgId);
            reservation.setStatus("pending");
            reservation.setPaymentStatus(PaymentStatus.PENDING);
            reservation.setStripeSessionId("cs_paid");

            when(reservationRepository.findById(101L)).thenReturn(Optional.of(reservation));
            when(reservationRepository.save(reservation)).thenReturn(reservation);
            when(stripeService.expireCheckoutSession("cs_paid"))
                    .thenReturn(StripeService.CheckoutSessionExpiryResult.PAID);

            // Act
            reservationService.cancel(101L);

            // Assert
            verify(stripeService).refundCheckoutSessionPayment(eq("cs_paid"), anyString());
        }

        @Test
        @DisplayName("no Stripe call when cancelled reservation has no session")
        void whenNoStripeSession_thenNoStripeCall() {
            // Arrange
            Reservation reservation = new Reservation();
            reservation.setId(102L);
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");

            when(reservationRepository.findById(102L)).thenReturn(Optional.of(reservation));
            when(reservationRepository.save(reservation)).thenReturn(reservation);

            // Act
            reservationService.cancel(102L);

            // Assert
            verifyNoInteractions(stripeService);
        }
    }

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("should filter by propertyIds when provided")
        void whenPropertyIdsProvided_thenFilters() {
            // Arrange
            User user = buildUser(1L, "kc-1", UserRole.HOST);
            List<Long> propertyIds = List.of(1L, 2L);

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(reservationRepository.findByPropertyIdsAndDateRange(propertyIds, checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            List<Reservation> result = reservationService.getReservations("kc-1", propertyIds, checkIn, checkOut);

            // Assert
            verify(reservationRepository).findByPropertyIdsAndDateRange(propertyIds, checkIn, checkOut, orgId);
        }

        @Test
        @DisplayName("should return all reservations for admin without propertyIds")
        void whenAdminWithoutPropertyIds_thenReturnsAll() {
            // Arrange
            User admin = buildUser(1L, "kc-admin", UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(reservationRepository.findAllByDateRange(checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            List<Reservation> result = reservationService.getReservations("kc-admin", null, checkIn, checkOut);

            // Assert
            verify(reservationRepository).findAllByDateRange(checkIn, checkOut, orgId);
        }

        @Test
        @DisplayName("should return all reservations for manager without propertyIds")
        void whenManagerWithoutPropertyIds_thenReturnsAll() {
            // Arrange
            User manager = buildUser(1L, "kc-manager", UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-manager")).thenReturn(Optional.of(manager));
            when(reservationRepository.findAllByDateRange(checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            reservationService.getReservations("kc-manager", null, checkIn, checkOut);

            // Assert
            verify(reservationRepository).findAllByDateRange(checkIn, checkOut, orgId);
        }

        @Test
        @DisplayName("should return only host own properties without propertyIds")
        void whenHostWithoutPropertyIds_thenReturnsOwnProperties() {
            // Arrange
            User host = buildUser(1L, "kc-host", UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(host));
            when(reservationRepository.findByOwnerKeycloakIdAndDateRange("kc-host", checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            reservationService.getReservations("kc-host", null, checkIn, checkOut);

            // Assert
            verify(reservationRepository).findByOwnerKeycloakIdAndDateRange("kc-host", checkIn, checkOut, orgId);
        }

        @Test
        @DisplayName("should throw when user not found")
        void whenUserNotFound_thenThrows() {
            // Arrange
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> reservationService.getReservations("kc-unknown", null, checkIn, checkOut))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("should filter by propertyIds even for admin when propertyIds provided")
        void whenAdminWithPropertyIds_thenFilters() {
            // Arrange
            User admin = buildUser(1L, "kc-admin", UserRole.SUPER_ADMIN);
            List<Long> propertyIds = List.of(5L);
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(reservationRepository.findByPropertyIdsAndDateRange(propertyIds, checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            reservationService.getReservations("kc-admin", propertyIds, checkIn, checkOut);

            // Assert
            verify(reservationRepository).findByPropertyIdsAndDateRange(propertyIds, checkIn, checkOut, orgId);
            verify(reservationRepository, never()).findAllByDateRange(any(), any(), anyLong());
        }

        @Test
        @DisplayName("should use empty propertyIds same as null")
        void whenEmptyPropertyIds_thenTreatsAsNull() {
            // Arrange
            User admin = buildUser(1L, "kc-admin", UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(reservationRepository.findAllByDateRange(checkIn, checkOut, orgId))
                    .thenReturn(List.of());

            // Act
            reservationService.getReservations("kc-admin", List.of(), checkIn, checkOut);

            // Assert
            verify(reservationRepository).findAllByDateRange(checkIn, checkOut, orgId);
        }
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {

        @Test
        @DisplayName("should return reservations for a specific property")
        void whenPropertyExists_thenReturnsReservations() {
            // Arrange
            Reservation r1 = new Reservation();
            r1.setId(1L);
            when(reservationRepository.findByPropertyId(1L, orgId)).thenReturn(List.of(r1));

            // Act
            List<Reservation> result = reservationService.getByProperty(1L);

            // Assert
            assertThat(result).hasSize(1);
            verify(reservationRepository).findByPropertyId(1L, orgId);
        }

        @Test
        @DisplayName("should return empty list when no reservations")
        void whenNoReservations_thenReturnsEmpty() {
            // Arrange
            when(reservationRepository.findByPropertyId(999L, orgId)).thenReturn(List.of());

            // Act
            List<Reservation> result = reservationService.getByProperty(999L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("existsByExternalUid")
    class ExistsByExternalUid {

        @Test
        @DisplayName("should return true when reservation with UID exists")
        void whenExists_thenReturnsTrue() {
            // Arrange
            when(reservationRepository.existsByExternalUidAndPropertyId("uid-123", 1L)).thenReturn(true);

            // Act & Assert
            assertThat(reservationService.existsByExternalUid("uid-123", 1L)).isTrue();
        }

        @Test
        @DisplayName("should return false when no reservation with UID exists")
        void whenNotExists_thenReturnsFalse() {
            // Arrange
            when(reservationRepository.existsByExternalUidAndPropertyId("uid-123", 1L)).thenReturn(false);

            // Act & Assert
            assertThat(reservationService.existsByExternalUid("uid-123", 1L)).isFalse();
        }

        @Test
        @DisplayName("should return false when externalUid is null")
        void whenNullUid_thenReturnsFalse() {
            // Act & Assert
            assertThat(reservationService.existsByExternalUid(null, 1L)).isFalse();
            verifyNoInteractions(reservationRepository);
        }

        @Test
        @DisplayName("should return false when propertyId is null")
        void whenNullPropertyId_thenReturnsFalse() {
            // Act & Assert
            assertThat(reservationService.existsByExternalUid("uid-123", null)).isFalse();
            verifyNoInteractions(reservationRepository);
        }
    }

    // ============ EXTENDED COVERAGE ============

    @Nested
    @DisplayName("save - minimum nights validation")
    class SaveMinNights {

        @Test
        @DisplayName("throws when reservation is less than 1 night")
        void whenZeroNights_thenThrows() {
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkIn); // 0 nights

            assertThatThrownBy(() -> reservationService.save(reservation))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("respects property minimumNights default")
        void whenPropertyMinNightsExceeded_thenThrows() {
            property.setMinimumNights(7);

            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut); // 4 nights < 7

            assertThatThrownBy(() -> reservationService.save(reservation))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Minimum");
        }

        @Test
        @DisplayName("respects MinNightsOverride if present")
        void whenOverrideExceeded_thenThrows() {
            property.setMinimumNights(1);
            com.clenzy.model.MinNightsOverride override = new com.clenzy.model.MinNightsOverride();
            override.setMinNights(10);
            when(minNightsOverrideRepository.findByPropertyIdAndDate(eq(1L), eq(checkIn), eq(orgId)))
                    .thenReturn(Optional.of(override));

            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut); // 4 nights < 10

            assertThatThrownBy(() -> reservationService.save(reservation))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("allows reservation when minNights satisfied")
        void whenMinNightsSatisfied_thenSaves() {
            property.setMinimumNights(2);
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut); // 4 nights >= 2

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), any(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(1L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            when(reservationRepository.save(reservation)).thenReturn(saved);

            reservationService.save(reservation);

            verify(calendarEngine).book(anyLong(), any(), any(), any(), anyLong(), any(), any());
        }
    }

    @Nested
    @DisplayName("save - guest stats recording")
    class SaveGuestStats {
        @Test
        @DisplayName("when guest is set and totalPrice provided, records stay")
        void whenGuestAndPrice_thenRecordsStay() {
            Guest guest = new Guest();
            guest.setId(50L);
            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setStatus("confirmed");
            reservation.setSource("MANUAL");
            reservation.setProperty(property);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);
            reservation.setGuest(guest);
            reservation.setTotalPrice(new java.math.BigDecimal("200.00"));

            when(calendarEngine.book(anyLong(), any(), any(), any(), anyLong(), any(), any()))
                    .thenReturn(List.of());

            Reservation saved = new Reservation();
            saved.setId(1L);
            saved.setProperty(property);
            saved.setCheckIn(checkIn);
            saved.setCheckOut(checkOut);
            saved.setGuest(guest);
            saved.setTotalPrice(new java.math.BigDecimal("200.00"));
            when(reservationRepository.save(reservation)).thenReturn(saved);

            reservationService.save(reservation);

            verify(guestService).recordStay(50L, new java.math.BigDecimal("200.00"));
        }
    }

    @Nested
    @DisplayName("createCleaningForReservation")
    class CreateCleaning {
        @Test
        @DisplayName("creates ServiceRequest with PENDING status")
        void createsServiceRequest() {
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(orgId);
            reservation.setProperty(property);
            reservation.setCheckOut(checkOut);
            reservation.setCheckOutTime("11:00");
            reservation.setGuestName("John");
            reservation.setCleaningFee(new java.math.BigDecimal("50.00"));

            User requestor = buildUser(1L, "kc-user", UserRole.HOST);

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
            when(userRepository.findByKeycloakId("kc-user")).thenReturn(Optional.of(requestor));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> {
                ServiceRequest sr = inv.getArgument(0);
                sr.setId(99L);
                return sr;
            });

            reservationService.createCleaningForReservation(reservation, "kc-user");

            org.mockito.ArgumentCaptor<ServiceRequest> captor = org.mockito.ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(RequestStatus.PENDING);
            assertThat(captor.getValue().getEstimatedCost()).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("falls back to property.cleaningBasePrice when reservation has no fee")
        void whenNoFee_thenUsesPropertyCleaningBase() {
            property.setCleaningBasePrice(new java.math.BigDecimal("80.00"));
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(orgId);
            reservation.setProperty(property);
            reservation.setCheckOut(checkOut);
            reservation.setCheckOutTime("11:00");
            reservation.setGuestName("Jane");

            User requestor = buildUser(1L, "kc-user", UserRole.HOST);
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
            when(userRepository.findByKeycloakId("kc-user")).thenReturn(Optional.of(requestor));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> {
                ServiceRequest sr = inv.getArgument(0);
                sr.setId(99L);
                return sr;
            });

            reservationService.createCleaningForReservation(reservation, "kc-user");

            org.mockito.ArgumentCaptor<ServiceRequest> captor = org.mockito.ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getEstimatedCost()).isEqualByComparingTo("80.00");
        }

        @Test
        @DisplayName("uses cleaning duration when available")
        void whenDurationProvided_thenSetsEstimatedDuration() {
            property.setCleaningDurationMinutes(150); // 2.5h -> ceil = 3h
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(orgId);
            reservation.setProperty(property);
            reservation.setCheckOut(checkOut);
            reservation.setCheckOutTime("11:30");
            reservation.setGuestName("X");

            User requestor = buildUser(1L, "kc-user", UserRole.HOST);
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
            when(userRepository.findByKeycloakId("kc-user")).thenReturn(Optional.of(requestor));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> {
                ServiceRequest sr = inv.getArgument(0);
                sr.setId(99L);
                return sr;
            });

            reservationService.createCleaningForReservation(reservation, "kc-user");

            org.mockito.ArgumentCaptor<ServiceRequest> captor = org.mockito.ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getEstimatedDurationHours()).isEqualTo(3);
        }

        @Test
        @DisplayName("throws when reservation not found in reload")
        void whenReservationGone_thenThrows() {
            Reservation reservation = new Reservation();
            reservation.setId(404L);

            when(reservationRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.createCleaningForReservation(reservation, "kc-user"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("throws when user not found")
        void whenUserNotFound_thenThrows() {
            Reservation reservation = new Reservation();
            reservation.setId(100L);
            reservation.setOrganizationId(orgId);
            reservation.setProperty(property);
            reservation.setCheckOut(checkOut);
            reservation.setCheckOutTime("11:00");

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
            when(userRepository.findByKeycloakId("ghost")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.createCleaningForReservation(reservation, "ghost"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("notifyReservationUpdated")
    class NotifyReservationUpdated {
        @Test
        @DisplayName("notifies owner and admins when reservation has owner")
        void whenOwnerPresent_thenNotifies() {
            User owner = new User();
            owner.setKeycloakId("owner-kc");
            property.setOwner(owner);

            Reservation reservation = new Reservation();
            reservation.setProperty(property);
            reservation.setGuestName("X");
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);

            reservationService.notifyReservationUpdated(reservation);

            verify(notificationService).notify(eq("owner-kc"), eq(NotificationKey.RESERVATION_UPDATED),
                    any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.RESERVATION_UPDATED), any(), any(), any());
        }

        @Test
        @DisplayName("safely handles null property")
        void whenNullProperty_thenJustNotifiesAdmins() {
            Reservation reservation = new Reservation();
            reservation.setProperty(null);
            reservation.setGuestName(null);

            // Should not throw
            reservationService.notifyReservationUpdated(reservation);
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.RESERVATION_UPDATED), any(), any(), any());
        }

        @Test
        @DisplayName("swallows downstream notification errors")
        void whenNotificationFails_thenNoExceptionPropagates() {
            org.mockito.Mockito.doThrow(new RuntimeException("notif down"))
                    .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

            Reservation reservation = new Reservation();
            reservation.setProperty(null);

            reservationService.notifyReservationUpdated(reservation);
            // No exception propagated
        }
    }

    // ── Methodes deplacees de ReservationController (T-ARCH-01) ─────────────

    @Nested
    @DisplayName("getByIdFetchAll / reloadWithRelations")
    class FetchAll {

        @Test
        void whenReservationExists_thenReturnsIt() {
            Reservation r = new Reservation();
            r.setId(5L);
            when(reservationRepository.findByIdFetchAll(5L)).thenReturn(Optional.of(r));

            assertThat(reservationService.getByIdFetchAll(5L)).isSameAs(r);
        }

        @Test
        void whenReservationMissing_thenThrowsNotFound() {
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.getByIdFetchAll(99L))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class)
                    .hasMessageContaining("99");
        }

        @Test
        void whenReloadSucceeds_thenReturnsReloadedInstance() {
            Reservation stale = new Reservation();
            stale.setId(7L);
            Reservation fresh = new Reservation();
            fresh.setId(7L);
            when(reservationRepository.findByIdFetchAll(7L)).thenReturn(Optional.of(fresh));

            assertThat(reservationService.reloadWithRelations(stale)).isSameAs(fresh);
        }

        @Test
        void whenReloadFails_thenFallsBackToGivenInstance() {
            Reservation stale = new Reservation();
            stale.setId(7L);
            when(reservationRepository.findByIdFetchAll(7L)).thenReturn(Optional.empty());

            assertThat(reservationService.reloadWithRelations(stale)).isSameAs(stale);
        }
    }

    @Nested
    @DisplayName("searchByGuestOrProperty / getLinkedInterventions")
    class SearchAndLinked {

        @Test
        void whenSearching_thenDelegatesWithLimit() {
            Reservation r = new Reservation();
            when(reservationRepository.searchByGuestOrProperty(eq("ali"),
                    eq(org.springframework.data.domain.PageRequest.of(0, 15))))
                    .thenReturn(List.of(r));

            List<Reservation> result = reservationService.searchByGuestOrProperty("ali", 15);

            assertThat(result).containsExactly(r);
        }

        @Test
        void whenListingLinkedInterventions_thenScopedToCurrentOrg() {
            Intervention intervention = new Intervention();
            when(interventionRepository.findByReservationId(3L, orgId))
                    .thenReturn(List.of(intervention));

            List<Intervention> result = reservationService.getLinkedInterventions(3L);

            assertThat(result).containsExactly(intervention);
            verify(interventionRepository).findByReservationId(3L, orgId);
        }
    }

    @Nested
    @DisplayName("validateGuestBelongsToOrganization")
    class ValidateGuest {

        @Test
        void whenGuestIdNull_thenNoLookup() {
            reservationService.validateGuestBelongsToOrganization(null);

            verifyNoInteractions(guestRepository);
        }

        @Test
        void whenGuestInOrg_thenPasses() {
            when(guestRepository.findByIdAndOrganizationId(50L, orgId))
                    .thenReturn(Optional.of(new Guest()));

            reservationService.validateGuestBelongsToOrganization(50L);

            verify(guestRepository).findByIdAndOrganizationId(50L, orgId);
        }

        @Test
        void whenGuestMissing_thenThrowsNotFound() {
            when(guestRepository.findByIdAndOrganizationId(50L, orgId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.validateGuestBelongsToOrganization(50L))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class)
                    .hasMessageContaining("50");
        }
    }

    @Nested
    @DisplayName("validatePropertyAccess")
    class ValidatePropertyAccessTests {

        private Property buildOwnedProperty(Long ownerId, String ownerKeycloakId, Long propertyOrgId) {
            Property p = new Property();
            p.setId(1L);
            p.setOrganizationId(propertyOrgId);
            User owner = buildUser(ownerId, ownerKeycloakId, UserRole.HOST);
            p.setOwner(owner);
            return p;
        }

        @Test
        void whenPropertyMissing_thenThrowsNotFound() {
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.validatePropertyAccess(99L, "user-1"))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class);
        }

        @Test
        void whenPropertyInOtherOrg_thenAccessDenied() {
            Property p = buildOwnedProperty(1L, "user-1", 99L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));

            assertThatThrownBy(() -> reservationService.validatePropertyAccess(1L, "user-1"))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class)
                    .hasMessageContaining("hors de votre organisation");
        }

        @Test
        void whenOwnerMatches_thenPasses() {
            Property p = buildOwnedProperty(1L, "user-1", orgId);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));
            when(userRepository.findByKeycloakId("user-1"))
                    .thenReturn(Optional.of(p.getOwner()));

            reservationService.validatePropertyAccess(1L, "user-1");
        }

        @Test
        void whenNotOwnerNorStaff_thenAccessDenied() {
            Property p = buildOwnedProperty(1L, "real-owner", orgId);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));
            User intruder = buildUser(42L, "intruder", UserRole.HOST);
            when(userRepository.findByKeycloakId("intruder")).thenReturn(Optional.of(intruder));

            assertThatThrownBy(() -> reservationService.validatePropertyAccess(1L, "intruder"))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class)
                    .hasMessageContaining("proprietaire");
        }

        @Test
        void whenPlatformStaff_thenBypassesOwnership() {
            Property p = buildOwnedProperty(1L, "real-owner", orgId);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));
            User staff = buildUser(42L, "staff", UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("staff")).thenReturn(Optional.of(staff));

            reservationService.validatePropertyAccess(1L, "staff");
        }

        @Test
        void whenSuperAdminContext_thenBypassesOwnership() {
            tenantContext.setSuperAdmin(true);
            Property p = buildOwnedProperty(1L, "real-owner", orgId);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));

            reservationService.validatePropertyAccess(1L, "anyone");

            verifyNoInteractions(userRepository);
        }

        @Test
        void whenPropertyOrgIdNull_thenOwnershipStillChecked() {
            Property p = buildOwnedProperty(1L, "user-1", null);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(p));
            when(userRepository.findByKeycloakId("user-1"))
                    .thenReturn(Optional.of(p.getOwner()));

            reservationService.validatePropertyAccess(1L, "user-1");
        }
    }

    @Nested
    @DisplayName("persistHiddenFromPlanning")
    class PersistHiddenFromPlanning {

        @Test
        void whenPersisting_thenSavesAsIs() {
            Reservation r = new Reservation();
            r.setId(4L);
            r.setHiddenFromPlanning(true);
            when(reservationRepository.save(r)).thenReturn(r);

            Reservation result = reservationService.persistHiddenFromPlanning(r);

            assertThat(result).isSameAs(r);
            verify(reservationRepository).save(r);
        }
    }
}
