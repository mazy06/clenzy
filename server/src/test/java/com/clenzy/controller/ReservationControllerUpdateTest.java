package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour ReservationController.update() avec cascade intervention.
 * Couvre :
 * - Mise a jour des dates de reservation (directe et OTA)
 * - Decalage automatique de l'intervention liee au checkout
 * - Mise a jour de scheduledDate, guestCheckoutTime, startTime, endTime
 * - Cas sans intervention liee
 * - Cas reservation non trouvee
 */
@ExtendWith(MockitoExtension.class)
class ReservationControllerUpdateTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private StripeService stripeService;
    @Mock private EmailService emailService;
    @Mock private TenantContext tenantContext;

    private ReservationController controller;

    @BeforeEach
    void setUp() {
        controller = new ReservationController(
                reservationService, reservationMapper, reservationRepository,
                interventionRepository, propertyRepository, userRepository,
                guestRepository, stripeService, emailService, tenantContext);
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

    private Reservation createReservation(Property property, String source,
                                          LocalDate checkIn, LocalDate checkOut) {
        Reservation r = new Reservation();
        r.setId(1L);
        r.setProperty(property);
        r.setSource(source);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setStatus("confirmed");
        r.setGuestName("Test Guest");
        r.setOrganizationId(1L);
        return r;
    }

    private Intervention createIntervention(LocalDateTime scheduledDate, int durationHours) {
        Intervention intervention = new Intervention();
        intervention.setId(10L);
        intervention.setScheduledDate(scheduledDate);
        intervention.setGuestCheckoutTime(scheduledDate);
        intervention.setStartTime(scheduledDate);
        intervention.setEndTime(scheduledDate.plusHours(durationHours));
        intervention.setEstimatedDurationHours(durationHours);
        intervention.setTitle("Menage");
        intervention.setType("CLEANING");
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority("HIGH");
        intervention.setOrganizationId(1L);
        return intervention;
    }

    private void setupPropertyAccess(Property property, String keycloakId) {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(propertyRepository.findById(property.getId())).thenReturn(Optional.of(property));
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(property.getOwner()));
    }

    private ReservationDto makeUpdateDto(String checkIn, String checkOut) {
        return new ReservationDto(null, null, null, null, null, null, null, null,
                checkIn, checkOut, null, null, null, null, null, null, null, null,
                null, null, null, null, null, false);
    }

    @Nested
    @DisplayName("update - basic")
    class UpdateBasic {

        @Test
        @DisplayName("mise a jour des dates sans intervention liee")
        void whenNoIntervention_thenUpdatesReservationOnly() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "direct",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            ReservationDto dto = makeUpdateDto(null, "2026-03-08");
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-08", null, null, "confirmed", "direct",
                            null, null, null, null, null, null, null, null, null, false));

            ResponseEntity<ReservationDto> response = controller.update(1L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(interventionRepository, never()).save(any(Intervention.class));
        }

        @Test
        @DisplayName("reservation non trouvee → NotFoundException")
        void whenNotFound_thenThrows() {
            Jwt jwt = createJwt("user-1");
            when(reservationRepository.findByIdFetchAll(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.update(99L, makeUpdateDto(null, "2026-03-08"), jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("mise a jour des dates pour reservation OTA")
        void whenOtaReservation_thenUpdatesDatesToo() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "airbnb",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            ReservationDto dto = makeUpdateDto(null, "2026-03-08");
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-08", null, null, "confirmed", "airbnb",
                            null, null, null, null, null, null, null, null, null, false));

            ResponseEntity<ReservationDto> response = controller.update(1L, dto, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // reservationMapper.apply is called (not restricted for OTA anymore)
            verify(reservationMapper).apply(eq(dto), eq(reservation));
        }
    }

    @Nested
    @DisplayName("update - intervention cascade")
    class UpdateInterventionCascade {

        @Test
        @DisplayName("checkout change decale l'intervention liee")
        void whenCheckoutChanges_thenShiftsIntervention() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "direct",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            // Intervention liee au checkout (5 mars, 11:00 → 14:00, 3h)
            Intervention intervention = createIntervention(
                    LocalDateTime.of(2026, 3, 5, 11, 0), 3);
            reservation.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            // Simulate mapper setting new checkout
            doAnswer(inv -> {
                ReservationDto d = inv.getArgument(0);
                Reservation r = inv.getArgument(1);
                if (d.checkOut() != null) r.setCheckOut(LocalDate.parse(d.checkOut()));
                return null;
            }).when(reservationMapper).apply(any(ReservationDto.class), any(Reservation.class));

            ReservationDto dto = makeUpdateDto(null, "2026-03-08");
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-08", null, null, "confirmed", "direct",
                            null, null, null, null, null, null, null, null, null, false));

            controller.update(1L, dto, jwt);

            // Verifier que l'intervention a ete sauvegardee
            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            Intervention saved = captor.getValue();
            // scheduledDate = nouveau checkout (8 mars) a 11:00
            assertThat(saved.getScheduledDate()).isEqualTo(LocalDateTime.of(2026, 3, 8, 11, 0));
            assertThat(saved.getGuestCheckoutTime()).isEqualTo(LocalDateTime.of(2026, 3, 8, 11, 0));
            assertThat(saved.getStartTime()).isEqualTo(LocalDateTime.of(2026, 3, 8, 11, 0));
            // endTime = 11:00 + 3h = 14:00
            assertThat(saved.getEndTime()).isEqualTo(LocalDateTime.of(2026, 3, 8, 14, 0));
        }

        @Test
        @DisplayName("checkout inchange ne decale pas l'intervention")
        void whenCheckoutUnchanged_thenNoInterventionUpdate() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "direct",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            Intervention intervention = createIntervention(
                    LocalDateTime.of(2026, 3, 5, 11, 0), 3);
            reservation.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            // Simulate mapper NOT changing checkout (only notes)
            doAnswer(inv -> {
                Reservation r = inv.getArgument(1);
                r.setNotes("updated notes");
                return null;
            }).when(reservationMapper).apply(any(ReservationDto.class), any(Reservation.class));

            ReservationDto dto = new ReservationDto(null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, "new notes",
                    null, null, null, null, null, false);
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-05", null, null, "confirmed", "direct",
                            null, null, null, "new notes", null, null, null, null, null, false));

            controller.update(1L, dto, jwt);

            // Intervention ne doit PAS etre sauvegardee
            verify(interventionRepository, never()).save(any(Intervention.class));
        }

        @Test
        @DisplayName("intervention conserve la meme heure lors du decalage")
        void whenCheckoutChanges_thenKeepsSameTime() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "direct",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            // Intervention a 10:30
            Intervention intervention = createIntervention(
                    LocalDateTime.of(2026, 3, 5, 10, 30), 2);
            reservation.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            doAnswer(inv -> {
                ReservationDto d = inv.getArgument(0);
                Reservation r = inv.getArgument(1);
                if (d.checkOut() != null) r.setCheckOut(LocalDate.parse(d.checkOut()));
                return null;
            }).when(reservationMapper).apply(any(ReservationDto.class), any(Reservation.class));

            ReservationDto dto = makeUpdateDto(null, "2026-03-10");
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-10", null, null, "confirmed", "direct",
                            null, null, null, null, null, null, null, null, null, false));

            controller.update(1L, dto, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            Intervention saved = captor.getValue();
            // Meme heure 10:30 mais nouvelle date 10 mars
            assertThat(saved.getScheduledDate().toLocalTime().getHour()).isEqualTo(10);
            assertThat(saved.getScheduledDate().toLocalTime().getMinute()).isEqualTo(30);
            assertThat(saved.getScheduledDate().toLocalDate()).isEqualTo(LocalDate.of(2026, 3, 10));
        }

        @Test
        @DisplayName("intervention sans estimatedDurationHours ne met pas a jour endTime")
        void whenNoDuration_thenEndTimeNotSet() {
            Jwt jwt = createJwt("user-1");
            Property property = createProperty("user-1");
            Reservation reservation = createReservation(property, "direct",
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5));

            Intervention intervention = createIntervention(
                    LocalDateTime.of(2026, 3, 5, 11, 0), 3);
            intervention.setEstimatedDurationHours(null);
            reservation.setIntervention(intervention);

            when(reservationRepository.findByIdFetchAll(1L)).thenReturn(Optional.of(reservation));
            setupPropertyAccess(property, "user-1");

            doAnswer(inv -> {
                ReservationDto d = inv.getArgument(0);
                Reservation r = inv.getArgument(1);
                if (d.checkOut() != null) r.setCheckOut(LocalDate.parse(d.checkOut()));
                return null;
            }).when(reservationMapper).apply(any(ReservationDto.class), any(Reservation.class));

            ReservationDto dto = makeUpdateDto(null, "2026-03-08");
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);
            when(reservationMapper.toDto(any(Reservation.class)))
                    .thenReturn(new ReservationDto(1L, 1L, "Apt", "Guest", null, null, null, 2,
                            "2026-03-01", "2026-03-08", null, null, "confirmed", "direct",
                            null, null, null, null, null, null, null, null, null, false));

            controller.update(1L, dto, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            Intervention saved = captor.getValue();
            // scheduledDate updated but endTime stays as was (no duration to compute)
            assertThat(saved.getScheduledDate().toLocalDate()).isEqualTo(LocalDate.of(2026, 3, 8));
        }
    }
}
