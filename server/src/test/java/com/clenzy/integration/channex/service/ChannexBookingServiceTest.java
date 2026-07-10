package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.GuestService;
import com.clenzy.service.NotificationService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de {@link ChannexBookingService}.
 *
 * <p>Couvre :</p>
 * <ul>
 *   <li>handleNewBooking : creation Reservation + idempotence + book calendrier
 *       + ack + notification + gestion conflits</li>
 *   <li>handleModification : retrouve reservation existante, applique dates/prix/guest
 *       + creation fallback si introuvable</li>
 *   <li>handleCancellation : passe status="cancelled" + libere calendrier</li>
 *   <li>validateBookingPayload : edge cases (null, dates inversees, manque IDs)</li>
 *   <li>resolveGuestChannel : mapping otaName -> GuestChannel</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexBookingService")
class ChannexBookingServiceTest {

    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private GuestService guestService;
    @Mock private CalendarEngine calendarEngine;
    @Mock private NotificationService notificationService;
    @Mock private com.clenzy.repository.CalendarDayRepository calendarDayRepository;

    private ChannexBookingService service;
    private ChannexPropertyMapping mapping;
    private Property property;
    private Guest guest;

    @BeforeEach
    void setUp() {
        ChannexMetrics metrics = new ChannexMetrics(new SimpleMeterRegistry());
        service = new ChannexBookingService(
            mappingRepository, reservationRepository, propertyRepository,
            guestService, calendarEngine, notificationService, metrics,
            calendarDayRepository
        );

        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("channex-prop-1");

        property = new Property();
        property.setId(100L);
        property.setOrganizationId(42L);
        property.setName("Studio Marais");
        property.setDefaultCheckInTime("15:00");
        property.setDefaultCheckOutTime("11:00");
        property.setDefaultCurrency("EUR");

        guest = new Guest();
        guest.setId(7L);
        guest.setFirstName("Jane");
        guest.setLastName("Doe");
        guest.setEmail("jane@x.com");
    }

    private ChannexBookingDto bookingDto(String id, String status,
                                          LocalDate arrival, LocalDate departure) {
        var customer = new ChannexBookingDto.ChannexCustomer(
            "Jane", "Doe", "jane@x.com", "+33123456789", "FR", "fr");
        var occupancy = new ChannexBookingDto.ChannexOccupancy(2, 1, 0);
        var room = new ChannexBookingDto.ChannexBookingRoom("rt-1", "rp-1", occupancy);
        return new ChannexBookingDto(
            id, null, null, "OTA-CODE-" + id, "Airbnb", "channex-prop-1",
            status, arrival, departure,
            new BigDecimal("289.50"), "EUR",
            customer, List.of(room));
    }

    // ─── handleNewBooking ───────────────────────────────────────────────────

    @Test
    @DisplayName("handleNewBooking: cree Reservation + book calendrier + ack + notification")
    void handleNewBooking_createsReservationAndSideEffects() {
        var booking = bookingDto("book-1", "new",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(
            "channex:book-1", 100L)).thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(),
            eq(GuestChannel.AIRBNB), any(), eq(42L))).thenReturn(guest);
        when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });

        Reservation result = service.handleNewBooking(booking);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(999L);
        ArgumentCaptor<Reservation> rCap = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository).save(rCap.capture());
        Reservation saved = rCap.getValue();
        assertThat(saved.getOrganizationId()).isEqualTo(42L);
        assertThat(saved.getCheckIn()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(saved.getCheckOut()).isEqualTo(LocalDate.of(2026, 6, 5));
        assertThat(saved.getStatus()).isEqualTo("confirmed");
        assertThat(saved.getSource()).isEqualTo("channex");
        assertThat(saved.getSourceName()).isEqualTo("Airbnb");
        assertThat(saved.getExternalUid()).isEqualTo("channex:book-1");
        assertThat(saved.getCurrency()).isEqualTo("EUR");
        assertThat(saved.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        // OTA-CODE-book-1 venait du dto
        assertThat(saved.getConfirmationCode()).isEqualTo("OTA-CODE-book-1");
        // 2+1+0 = 3 guests
        assertThat(saved.getGuestCount()).isEqualTo(3);

        // calendar book appele
        verify(calendarEngine).book(eq(100L), eq(LocalDate.of(2026, 6, 1)),
            eq(LocalDate.of(2026, 6, 5)), eq(999L), eq(42L), anyString(), anyString());

        // notif appelee
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.RESERVATION_CREATED), any(), any(), any());
    }

    @Test
    @DisplayName("handleNewBooking: confirmationCode fallback CHX-xxxxxx si pas d'otaReservationCode")
    void handleNewBooking_confirmationCodeFallback() {
        var customer = new ChannexBookingDto.ChannexCustomer("Bob", "Smith", null, null, null, null);
        var booking = new ChannexBookingDto(
            "abcd1234efgh", null, null, null, "Booking.com", "channex-prop-1",
            "new", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
            new BigDecimal("100"), null, customer, List.of());

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.handleNewBooking(booking);

        ArgumentCaptor<Reservation> rCap = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository).save(rCap.capture());
        // 8 premiers chars de l'id + prefix CHX-
        assertThat(rCap.getValue().getConfirmationCode()).isEqualTo("CHX-abcd1234");
        // currency null → fallback property default
        assertThat(rCap.getValue().getCurrency()).isEqualTo("EUR");
        // GuestCount fallback à 1 (totalGuests sans rooms)
        assertThat(rCap.getValue().getGuestCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("handleNewBooking: idempotent — booking deja persiste → return existing sans save")
    void handleNewBooking_idempotent() {
        var booking = bookingDto("book-dup", "new",
            LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 3));

        Reservation existing = new Reservation();
        existing.setId(123L);
        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(
            "channex:book-dup", 100L)).thenReturn(Optional.of(existing));

        Reservation result = service.handleNewBooking(booking);

        assertThat(result.getId()).isEqualTo(123L);
        verify(reservationRepository, never()).save(any());
        verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("handleNewBooking: overbooking (dates occupees) -> resa persistee, book() NON appele, pas d'exception")
    void handleNewBooking_overbookingPersistsWithoutPoisoningTx() {
        var booking = bookingDto("book-x", "new",
            LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });
        // Dates deja occupees -> le pre-check countConflicts renvoie > 0.
        when(calendarDayRepository.countConflicts(eq(100L), any(), any(), anyLong()))
            .thenReturn(3L);

        // Ne doit pas lever, la reservation est persistee (pour ack), et book() n'est
        // JAMAIS appele -> aucune transaction empoisonnee (bug feed d'origine).
        Reservation result = service.handleNewBooking(booking);
        assertThat(result).isNotNull();
        verify(reservationRepository).save(any());
        verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("handleNewBooking: notification KO loggue mais ne plante pas")
    void handleNewBooking_notifKoDoesNotFail() {
        var booking = bookingDto("book-notif", "new",
            LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(2L);
            return r;
        });
        doThrow(new RuntimeException("notif fail"))
            .when(notificationService).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());

        // Ne doit pas relever — le test passe si pas d'exception
        Reservation result = service.handleNewBooking(booking);
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("handleNewBooking: leve IllegalStateException si property du mapping absent en DB")
    void handleNewBooking_throwsIfPropertyMissing() {
        var booking = bookingDto("book-orphan", "new",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.handleNewBooking(booking))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("mappee Channex mais introuvable");
    }

    @Test
    @DisplayName("handleNewBooking: leve si pas de mapping pour la property Channex")
    void handleNewBooking_throwsIfNoMapping() {
        var booking = bookingDto("book-x", "new",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.handleNewBooking(booking))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun ChannexPropertyMapping");
    }

    // ─── validateBookingPayload edge cases ──────────────────────────────────

    @Nested
    @DisplayName("validateBookingPayload edge cases")
    class ValidatePayload {
        @Test
        @DisplayName("null booking → IllegalArgumentException")
        void nullBooking() {
            assertThatThrownBy(() -> service.handleNewBooking(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("null");
        }

        @Test
        @DisplayName("id null → IllegalArgumentException")
        void idNull() {
            var dto = new ChannexBookingDto(null, null, null, null, null, "channex-prop-1", "new",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
                BigDecimal.ONE, "EUR", null, List.of());
            assertThatThrownBy(() -> service.handleNewBooking(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("manque id");
        }

        @Test
        @DisplayName("propertyId null → IllegalArgumentException")
        void propertyIdNull() {
            var dto = new ChannexBookingDto("book-1", null, null, null, null, null, "new",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
                BigDecimal.ONE, "EUR", null, List.of());
            assertThatThrownBy(() -> service.handleNewBooking(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("propertyId");
        }

        @Test
        @DisplayName("arrival/departure null → IllegalArgumentException")
        void datesNull() {
            var dto = new ChannexBookingDto("book-1", null, null, null, null, "channex-prop-1", "new",
                null, null, BigDecimal.ONE, "EUR", null, List.of());
            assertThatThrownBy(() -> service.handleNewBooking(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dates");
        }

        @Test
        @DisplayName("arrival == departure → IllegalArgumentException (must be strictly before)")
        void datesEqual() {
            var dto = new ChannexBookingDto("book-1", null, null, null, null, "channex-prop-1", "new",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 1),
                BigDecimal.ONE, "EUR", null, List.of());
            assertThatThrownBy(() -> service.handleNewBooking(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("strictement avant");
        }

        @Test
        @DisplayName("arrival > departure → IllegalArgumentException")
        void datesInverted() {
            var dto = new ChannexBookingDto("book-1", null, null, null, null, "channex-prop-1", "new",
                LocalDate.of(2026, 6, 5), LocalDate.of(2026, 6, 1),
                BigDecimal.ONE, "EUR", null, List.of());
            assertThatThrownBy(() -> service.handleNewBooking(dto))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── handleModification ─────────────────────────────────────────────────

    @Test
    @DisplayName("handleModification: dates change → cancel + book + save avec nouvelles dates")
    void handleModification_datesChanged() {
        var booking = bookingDto("book-mod", "modified",
            LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 15));

        Reservation existing = new Reservation();
        existing.setId(500L);
        existing.setOrganizationId(42L);
        existing.setCheckIn(LocalDate.of(2026, 6, 1));
        existing.setCheckOut(LocalDate.of(2026, 6, 5));
        existing.setGuestCount(2);

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(
            "channex:book-mod", 100L)).thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<Reservation> result = service.handleModification(booking);

        assertThat(result).isPresent();
        verify(calendarEngine).cancel(eq(500L), eq(42L), anyString());
        verify(calendarEngine).book(eq(100L), eq(LocalDate.of(2026, 6, 10)),
            eq(LocalDate.of(2026, 6, 15)), eq(500L), eq(42L), anyString(), anyString());
        assertThat(result.get().getCheckIn()).isEqualTo(LocalDate.of(2026, 6, 10));
        assertThat(result.get().getCheckOut()).isEqualTo(LocalDate.of(2026, 6, 15));
        // 2+1+0 = 3 guests dans le booking dto
        assertThat(result.get().getGuestCount()).isEqualTo(3);
        // totalPrice = 289.50 du booking
        assertThat(result.get().getTotalPrice()).isEqualByComparingTo("289.50");
    }

    @Test
    @DisplayName("handleModification: dates inchangées → pas de cancel+book, juste update guests+amount")
    void handleModification_noDateChange() {
        var booking = bookingDto("book-same", "modified",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        Reservation existing = new Reservation();
        existing.setId(501L);
        existing.setOrganizationId(42L);
        existing.setCheckIn(LocalDate.of(2026, 6, 1));
        existing.setCheckOut(LocalDate.of(2026, 6, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<Reservation> result = service.handleModification(booking);

        assertThat(result).isPresent();
        verify(calendarEngine, never()).cancel(any(), any(), any());
        verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
        verify(reservationRepository).save(any());
    }

    @Test
    @DisplayName("handleModification: reservation introuvable → cree a la volee via handleNewBooking")
    void handleModification_createsIfMissing() {
        var booking = bookingDto("book-late", "modified",
            LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(700L);
            return r;
        });

        Optional<Reservation> result = service.handleModification(booking);

        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(700L);
    }

    @Test
    @DisplayName("handleModification: re-book sur dates occupees (overbooking) → resa conservee, book() non appele")
    void handleModification_reBookConflictSwallowed() {
        var booking = bookingDto("book-mod-c", "modified",
            LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 5));

        Reservation existing = new Reservation();
        existing.setId(800L);
        existing.setOrganizationId(42L);
        existing.setCheckIn(LocalDate.of(2026, 6, 1));
        existing.setCheckOut(LocalDate.of(2026, 6, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Nouvelles dates deja occupees -> pre-check countConflicts > 0.
        when(calendarDayRepository.countConflicts(eq(100L), any(), any(), anyLong()))
            .thenReturn(2L);

        Optional<Reservation> result = service.handleModification(booking);
        // toujours present, et book() jamais appele (pas de tx empoisonnee)
        assertThat(result).isPresent();
        verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
    }

    // ─── handleCancellation ─────────────────────────────────────────────────

    @Test
    @DisplayName("handleCancellation: passe status=cancelled + libere calendrier + notification")
    void handleCancellation_marksAndReleasesCalendar() {
        var booking = bookingDto("book-cxl", "cancelled",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        Reservation existing = new Reservation();
        existing.setId(900L);
        existing.setOrganizationId(42L);
        existing.setStatus("confirmed");

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(
            "channex:book-cxl", 100L)).thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<Reservation> result = service.handleCancellation(booking);

        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo("cancelled");
        verify(calendarEngine).cancel(eq(900L), eq(42L), anyString());
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.RESERVATION_CANCELLED), any(), any(), any());
    }

    @Test
    @DisplayName("handleCancellation: payload incomplet → Optional.empty + pas d'effet")
    void handleCancellation_emptyOnIncompletePayload() {
        // booking null
        assertThat(service.handleCancellation(null)).isEmpty();
        // id null
        assertThat(service.handleCancellation(
            new ChannexBookingDto(null, null, null, null, null, "channex-prop-1", "cancelled",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5),
                BigDecimal.ONE, "EUR", null, List.of()))).isEmpty();
        // propertyId null
        assertThat(service.handleCancellation(
            new ChannexBookingDto("book-1", null, null, null, null, null, "cancelled",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5),
                BigDecimal.ONE, "EUR", null, List.of()))).isEmpty();

        verify(reservationRepository, never()).save(any());
    }

    @Test
    @DisplayName("handleCancellation: reservation inconnue → Optional.empty")
    void handleCancellation_unknownReservation() {
        var booking = bookingDto("book-zzz", "cancelled",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());

        Optional<Reservation> result = service.handleCancellation(booking);
        assertThat(result).isEmpty();
        verify(reservationRepository, never()).save(any());
    }

    @Test
    @DisplayName("handleCancellation: reservation deja CANCELLED → skip sans save")
    void handleCancellation_alreadyCancelled() {
        var booking = bookingDto("book-dup-cxl", "cancelled",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        Reservation existing = new Reservation();
        existing.setId(1001L);
        existing.setOrganizationId(42L);
        existing.setStatus("cancelled");

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.of(existing));

        Optional<Reservation> result = service.handleCancellation(booking);
        assertThat(result).isPresent();
        verify(reservationRepository, never()).save(any());
        verify(calendarEngine, never()).cancel(any(), any(), any());
    }

    @Test
    @DisplayName("handleCancellation: liberation calendrier KO → loggue et continue")
    void handleCancellation_calendarKoSwallowed() {
        var booking = bookingDto("book-cxl-err", "cancelled",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        Reservation existing = new Reservation();
        existing.setId(1100L);
        existing.setOrganizationId(42L);
        existing.setStatus("confirmed");

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("cant free")).when(calendarEngine).cancel(any(), any(), any());

        Optional<Reservation> result = service.handleCancellation(booking);
        assertThat(result).isPresent();
        // Status quand meme mis a cancelled meme si le calendar a echoue
        assertThat(result.get().getStatus()).isEqualTo("cancelled");
    }

    @Test
    @DisplayName("handleCancellation: notif KO → loggue mais retourne la reservation")
    void handleCancellation_notifKoSwallowed() {
        var booking = bookingDto("book-cxl-notif", "cancelled",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

        Reservation existing = new Reservation();
        existing.setId(1200L);
        existing.setOrganizationId(42L);
        existing.setStatus("confirmed");

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.of(existing));
        when(reservationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("notif KO"))
            .when(notificationService).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());

        Optional<Reservation> result = service.handleCancellation(booking);
        assertThat(result).isPresent();
    }

    // ─── resolveGuestChannel mapping (via cas Booking + Vrbo + autre) ──────

    @Test
    @DisplayName("OTA 'Booking.com' → GuestChannel.BOOKING")
    void otaName_BookingMapsToBooking() {
        var customer = new ChannexBookingDto.ChannexCustomer("X", "Y", null, null, null, null);
        var booking = new ChannexBookingDto("b1", null, null, null, "Booking.com", "channex-prop-1",
            "new", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
            BigDecimal.ONE, "EUR", customer, List.of());

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(1L);
            return r;
        });

        service.handleNewBooking(booking);

        verify(guestService).findOrCreate(any(), any(), any(), any(),
            eq(GuestChannel.BOOKING), any(), eq(42L));
    }

    @Test
    @DisplayName("OTA 'Vrbo' → GuestChannel.VRBO")
    void otaName_VrboMapsToVrbo() {
        var customer = new ChannexBookingDto.ChannexCustomer("X", "Y", null, null, null, null);
        var booking = new ChannexBookingDto("b1", null, null, null, "Vrbo", "channex-prop-1",
            "new", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
            BigDecimal.ONE, "EUR", customer, List.of());

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(2L);
            return r;
        });

        service.handleNewBooking(booking);

        verify(guestService).findOrCreate(any(), any(), any(), any(),
            eq(GuestChannel.VRBO), any(), eq(42L));
    }

    @Test
    @DisplayName("OTA inconnu (Expedia) → GuestChannel.OTHER")
    void otaName_ExpediaMapsToOther() {
        var customer = new ChannexBookingDto.ChannexCustomer("X", "Y", null, null, null, null);
        var booking = new ChannexBookingDto("b1", null, null, null, "Expedia", "channex-prop-1",
            "new", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
            BigDecimal.ONE, "EUR", customer, List.of());

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(3L);
            return r;
        });

        service.handleNewBooking(booking);

        verify(guestService).findOrCreate(any(), any(), any(), any(),
            eq(GuestChannel.OTHER), any(), eq(42L));
    }

    @Test
    @DisplayName("OTA null → GuestChannel.DIRECT")
    void otaName_NullMapsToDirect() {
        var customer = new ChannexBookingDto.ChannexCustomer("X", "Y", null, null, null, null);
        var booking = new ChannexBookingDto("b1", null, null, null, null, "channex-prop-1",
            "new", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3),
            BigDecimal.ONE, "EUR", customer, List.of());

        when(mappingRepository.findByChannexPropertyIdAnyOrg("channex-prop-1"))
            .thenReturn(Optional.of(mapping));
        when(reservationRepository.findByExternalUidAndPropertyId(any(), eq(100L)))
            .thenReturn(Optional.empty());
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(guestService.findOrCreate(any(), any(), any(), any(), any(), any(), anyLong()))
            .thenReturn(guest);
        when(reservationRepository.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(4L);
            return r;
        });

        service.handleNewBooking(booking);

        verify(guestService).findOrCreate(any(), any(), any(), any(),
            eq(GuestChannel.DIRECT), any(), eq(42L));
    }

    @Test
    @DisplayName("ChannexBookingService.EXTERNAL_UID_PREFIX constante exposee")
    void externalUidPrefix_constant() {
        assertThat(ChannexBookingService.EXTERNAL_UID_PREFIX).isEqualTo("channex:");
    }
}
