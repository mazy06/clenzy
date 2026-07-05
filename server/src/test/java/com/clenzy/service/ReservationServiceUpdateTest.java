package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Guest;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests de ReservationService.update() (refactor Z5-BUGS-01 + T-ARCH-02).
 *
 * Couvre la synchronisation calendrier qui manquait sur le PUT :
 * - changement de dates d'une reservation confirmee → move (liberer + re-reserver)
 * - conflit de disponibilite → CalendarConflictException (409), rien n'est sauve
 * - pending → confirmed → book (bloque le calendrier)
 * - confirmed → cancelled → cancel (libere le calendrier)
 * et les comportements annexes deplaces du controller (intervention, guest iCal).
 */
@ExtendWith(MockitoExtension.class)
class ReservationServiceUpdateTest {

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
    @Mock private InterventionRepository interventionRepository;
    @Mock private com.clenzy.repository.PropertyRepository propertyRepository;
    @Mock private com.clenzy.repository.GuestRepository guestRepository;
    @Mock private StripeService stripeService;
    @Mock private com.clenzy.service.WebhookEventPublisher webhookEventPublisher;

    private TenantContext tenantContext;
    private ReservationService reservationService;

    private Property property;
    private Reservation existing;
    private final Long orgId = 1L;
    private final LocalDate checkIn = LocalDate.of(2026, 6, 1);
    private final LocalDate checkOut = LocalDate.of(2026, 6, 5);

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(orgId);

        reservationService = new ReservationService(
                reservationRepository, userRepository, tenantContext,
                calendarEngine, guestService, syncMetrics,
                serviceRequestRepository, notificationService,
                minNightsOverrideRepository, automationEvaluationService,
                smartLockDeviceRepository, smartLockAccessCodeService,
                reservationMapper, interventionRepository,
                propertyRepository, guestRepository, stripeService,
                webhookEventPublisher
        );

        property = new Property();
        property.setId(1L);

        existing = new Reservation();
        existing.setId(100L);
        existing.setOrganizationId(orgId);
        existing.setProperty(property);
        existing.setStatus("confirmed");
        existing.setSource("direct");
        existing.setCheckIn(checkIn);
        existing.setCheckOut(checkOut);
        existing.setGuest(new Guest());

        lenient().when(minNightsOverrideRepository.findByPropertyIdAndDate(anyLong(), any(), anyLong()))
                .thenReturn(Optional.empty());
    }

    private ReservationDto dtoWith(String newCheckIn, String newCheckOut, String status) {
        return new ReservationDto(null, null, null, null, null, null, null, null,
                newCheckIn, newCheckOut, null, null, status, null, null, null, null, null,
                null, null, null, null, null, false, null, null, null, null, null);
    }

    /** Simule l'application des dates du DTO sur l'entite (comportement du vrai mapper). */
    private void stubMapperAppliesDates() {
        doAnswer(inv -> {
            ReservationDto d = inv.getArgument(0);
            Reservation r = inv.getArgument(1);
            if (d.checkIn() != null) r.setCheckIn(LocalDate.parse(d.checkIn()));
            if (d.checkOut() != null) r.setCheckOut(LocalDate.parse(d.checkOut()));
            return null;
        }).when(reservationMapper).apply(any(ReservationDto.class), any(Reservation.class));
    }

    @Nested
    @DisplayName("update - synchronisation calendrier")
    class CalendarSync {

        @Test
        @DisplayName("changement de dates d'une confirmee → move (liberer anciens + re-reserver nouveaux)")
        void whenDatesChangeOnConfirmed_thenMovesCalendarDays() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            stubMapperAppliesDates();
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith("2026-06-10", "2026-06-14", null), "actor-1");

            // Assert : move recoit l'ancienne ET la nouvelle plage
            ArgumentCaptor<CalendarEngine.ReservationMove> captor =
                    ArgumentCaptor.forClass(CalendarEngine.ReservationMove.class);
            verify(calendarEngine).move(captor.capture());
            CalendarEngine.ReservationMove move = captor.getValue();
            assertThat(move.reservationId()).isEqualTo(100L);
            assertThat(move.orgId()).isEqualTo(orgId);
            assertThat(move.oldPropertyId()).isEqualTo(1L);
            assertThat(move.oldCheckIn()).isEqualTo(checkIn);
            assertThat(move.oldCheckOut()).isEqualTo(checkOut);
            assertThat(move.newCheckIn()).isEqualTo(LocalDate.of(2026, 6, 10));
            assertThat(move.newCheckOut()).isEqualTo(LocalDate.of(2026, 6, 14));
            assertThat(move.actorId()).isEqualTo("actor-1");
            verify(calendarEngine, never()).book(anyLong(), any(), any(), any(), anyLong(), any(), any());
            verify(calendarEngine, never()).cancel(anyLong(), anyLong(), any());
            verify(reservationRepository).save(existing);
        }

        @Test
        @DisplayName("conflit de dispo sur la nouvelle plage → exception 409 et aucune sauvegarde")
        void whenMoveConflicts_thenThrowsAndNothingSaved() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            stubMapperAppliesDates();
            when(calendarEngine.move(any(CalendarEngine.ReservationMove.class)))
                    .thenThrow(new CalendarConflictException(1L,
                            LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 14), 2));

            // Act & Assert
            assertThatThrownBy(() -> reservationService.update(
                    100L, dtoWith("2026-06-10", "2026-06-14", null), "actor-1"))
                    .isInstanceOf(CalendarConflictException.class);

            verify(syncMetrics).incrementDoubleBookingPrevented();
            verify(reservationRepository, never()).save(any(Reservation.class));
            verify(interventionRepository, never()).save(any());
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("pending → confirmed bloque le calendrier (book avec l'id de la reservation)")
        void whenPendingBecomesConfirmed_thenBooksCalendar() {
            // Arrange
            existing.setStatus("pending");
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, "confirmed"), "actor-1");

            // Assert
            assertThat(existing.getStatus()).isEqualTo("confirmed");
            verify(calendarEngine).book(1L, checkIn, checkOut, 100L, orgId, "direct", "actor-1");
            verify(calendarEngine, never()).move(any());
            verify(calendarEngine, never()).cancel(anyLong(), anyLong(), any());
        }

        @Test
        @DisplayName("pending → confirmed avec conflit → exception 409, statut non sauve")
        void whenPendingBecomesConfirmedWithConflict_thenThrows() {
            // Arrange
            existing.setStatus("pending");
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(calendarEngine.book(anyLong(), any(), any(), anyLong(), anyLong(), any(), any()))
                    .thenThrow(new CalendarConflictException(1L, checkIn, checkOut, 1));

            // Act & Assert
            assertThatThrownBy(() -> reservationService.update(
                    100L, dtoWith(null, null, "confirmed"), "actor-1"))
                    .isInstanceOf(CalendarConflictException.class);

            verify(syncMetrics).incrementDoubleBookingPrevented();
            verify(reservationRepository, never()).save(any(Reservation.class));
        }

        @Test
        @DisplayName("confirmed → cancelled libere le calendrier et revoque les codes")
        void whenConfirmedBecomesCancelled_thenReleasesCalendar() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, "cancelled"), "actor-1");

            // Assert
            assertThat(existing.getStatus()).isEqualTo("cancelled");
            verify(calendarEngine).cancel(100L, orgId, "actor-1");
            verify(smartLockAccessCodeService).revokeForReservation(100L, "system");
            verify(calendarEngine, never()).book(anyLong(), any(), any(), any(), anyLong(), any(), any());
            verify(calendarEngine, never()).move(any());
        }

        @Test
        @DisplayName("aucun changement de dates ni de statut → aucun appel calendrier")
        void whenNoDateOrStatusChange_thenNoCalendarInteraction() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, "confirmed"), "actor-1");

            // Assert
            verifyNoInteractions(calendarEngine);
        }

        @Test
        @DisplayName("changement de dates d'une pending → aucun appel calendrier (rien n'est bloque)")
        void whenDatesChangeOnPending_thenNoCalendarInteraction() {
            // Arrange
            existing.setStatus("pending");
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            stubMapperAppliesDates();
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith("2026-06-10", "2026-06-14", null), "actor-1");

            // Assert
            verifyNoInteractions(calendarEngine);
        }
    }

    @Nested
    @DisplayName("update - comportements annexes conserves")
    class PreservedBehaviors {

        @Test
        @DisplayName("checkout change → decale l'intervention liee (meme heure)")
        void whenCheckoutChanges_thenShiftsLinkedIntervention() {
            // Arrange
            Intervention intervention = new Intervention();
            intervention.setId(50L);
            intervention.setScheduledDate(LocalDateTime.of(2026, 6, 5, 10, 30));
            intervention.setEstimatedDurationHours(3);
            existing.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            stubMapperAppliesDates();
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, "2026-06-08", null), "actor-1");

            // Assert
            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            Intervention saved = captor.getValue();
            assertThat(saved.getScheduledDate()).isEqualTo(LocalDateTime.of(2026, 6, 8, 10, 30));
            assertThat(saved.getGuestCheckoutTime()).isEqualTo(LocalDateTime.of(2026, 6, 8, 10, 30));
            assertThat(saved.getStartTime()).isEqualTo(LocalDateTime.of(2026, 6, 8, 10, 30));
            assertThat(saved.getEndTime()).isEqualTo(LocalDateTime.of(2026, 6, 8, 13, 30));
        }

        @Test
        @DisplayName("checkout inchange → intervention non touchee")
        void whenCheckoutUnchanged_thenInterventionNotTouched() {
            // Arrange
            Intervention intervention = new Intervention();
            intervention.setId(50L);
            intervention.setScheduledDate(LocalDateTime.of(2026, 6, 5, 11, 0));
            existing.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, null), "actor-1");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("guest absent + guestName present (import iCal) → cree et lie le Guest")
        void whenGuestMissing_thenCreatesAndLinksGuest() {
            // Arrange
            existing.setGuest(null);
            existing.setGuestName("Anonymous");
            existing.setSource("ical");
            Guest guest = new Guest();
            guest.setId(7L);
            when(guestService.findOrCreateFromName("Anonymous", "ical", orgId)).thenReturn(guest);
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, null), "actor-1");

            // Assert
            assertThat(existing.getGuest()).isEqualTo(guest);
        }

        @Test
        @DisplayName("dates changees sur confirmee → codes serrure revoques puis regeneres")
        void whenDatesChange_thenRegeneratesAccessCodes() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            stubMapperAppliesDates();
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith("2026-06-10", "2026-06-14", null), "actor-1");

            // Assert
            verify(smartLockAccessCodeService).revokeForReservation(100L, "system");
            verify(smartLockDeviceRepository).findByPropertyIdAndStatus(
                    1L, com.clenzy.model.SmartLockDevice.DeviceStatus.ACTIVE);
        }

        @Test
        @DisplayName("notification de mise a jour envoyee apres sauvegarde")
        void whenUpdated_thenNotifies() {
            // Arrange
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));
            when(reservationRepository.save(existing)).thenReturn(existing);

            // Act
            reservationService.update(100L, dtoWith(null, null, null), "actor-1");

            // Assert
            verify(notificationService).notifyAdminsAndManagers(
                    any(), anyString(), anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("update - garde-fous")
    class Guards {

        @Test
        @DisplayName("reservation introuvable → NotFoundException")
        void whenNotFound_thenThrows() {
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reservationService.update(99L, dtoWith(null, null, null), "actor-1"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("reservation d'une autre organisation → acces refuse")
        void whenCrossTenant_thenAccessRefused() {
            existing.setOrganizationId(2L);
            when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> reservationService.update(100L, dtoWith(null, null, null), "actor-1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("hors de votre organisation");
            verifyNoInteractions(calendarEngine);
            verify(reservationRepository, never()).save(any(Reservation.class));
        }
    }
}
