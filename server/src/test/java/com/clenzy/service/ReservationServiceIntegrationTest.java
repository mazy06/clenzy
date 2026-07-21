package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'integration du ReservationService avec CalendarEngine.
 *
 * Verifie le workflow complet :
 * - save() d'une reservation confirmee → book CalendarDays + link reservation
 * - save() en double booking → CalendarConflictException
 * - cancel() → libere les CalendarDays + statut "cancelled"
 */
@Transactional
@Rollback
class ReservationServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private CalendarDayRepository calendarDayRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    private Organization org;
    private User owner;
    private Property property;
    private Long orgId;

    @BeforeEach
    void createTestData() {
        org = new Organization("Reservation Org", OrganizationType.INDIVIDUAL, "reservation-org");
        organizationRepository.save(org);
        orgId = org.getId();

        owner = new User("Pierre", "Lefebvre", "pierre.res@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-res-test");
        userRepository.save(owner);

        property = new Property("Appart Reservation", "5 bd Haussmann", 3, 2, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("120.00"));
        propertyRepository.save(property);

        setupTenantContext(orgId, true);
    }

    // ----------------------------------------------------------------
    // 1. save() d'une reservation confirmee → CalendarDays BOOKED + reservation liee
    // ----------------------------------------------------------------

    @Test
    void save_newConfirmed_booksCalendarAndLinks() {
        LocalDate checkIn = LocalDate.of(2027, 3, 1);
        LocalDate checkOut = LocalDate.of(2027, 3, 4); // 3 nuits

        Reservation reservation = new Reservation(property, "Jean Voyageur",
                checkIn, checkOut, "confirmed", "MANUAL");
        // L'orgId sera rempli par le service via tenantContext

        Reservation saved = reservationService.save(reservation);

        assertNotNull(saved.getId(), "La reservation doit avoir un ID apres save");
        assertEquals("confirmed", saved.getStatus());
        assertEquals(orgId, saved.getOrganizationId());

        // Verifier que les CalendarDays sont BOOKED
        List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), checkIn, checkOut.minusDays(1), orgId);

        assertEquals(3, days.size());
        for (CalendarDay day : days) {
            assertEquals(CalendarDayStatus.BOOKED, day.getStatus());
        }
    }

    // ----------------------------------------------------------------
    // 2. Deux reservations sur les memes dates → CalendarConflictException
    // ----------------------------------------------------------------

    @Test
    void save_duplicateBooking_throwsConflict() {
        LocalDate checkIn = LocalDate.of(2027, 4, 10);
        LocalDate checkOut = LocalDate.of(2027, 4, 13);

        // Premiere reservation reussit
        Reservation res1 = new Reservation(property, "Guest 1",
                checkIn, checkOut, "confirmed", "MANUAL");
        reservationService.save(res1);

        // Deuxieme reservation sur les memes dates → conflit
        Reservation res2 = new Reservation(property, "Guest 2",
                checkIn, checkOut, "confirmed", "MANUAL");

        assertThrows(CalendarConflictException.class, () ->
                reservationService.save(res2));
    }

    // ----------------------------------------------------------------
    // 3. cancel() libere les CalendarDays et met le statut a "cancelled"
    // ----------------------------------------------------------------

    @Test
    void cancel_releasesCalendarDays_and_updatesStatus() {
        LocalDate checkIn = LocalDate.of(2027, 5, 1);
        LocalDate checkOut = LocalDate.of(2027, 5, 4);

        // Creer et sauvegarder la reservation
        Reservation reservation = new Reservation(property, "Guest Cancel",
                checkIn, checkOut, "confirmed", "MANUAL");
        Reservation saved = reservationService.save(reservation);
        Long reservationId = saved.getId();

        // Verifier que les jours sont BOOKED
        List<CalendarDay> bookedDays = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), checkIn, checkOut.minusDays(1), orgId);
        assertEquals(3, bookedDays.size());
        bookedDays.forEach(d -> assertEquals(CalendarDayStatus.BOOKED, d.getStatus()));

        // Annuler
        Reservation cancelled = reservationService.cancel(reservationId);

        assertEquals("cancelled", cancelled.getStatus());
    }

    // ----------------------------------------------------------------
    // 4. getReservationsPage : filtres status/search en SQL + pagination
    //    (audit perf 2026-07-21, P1-6)
    // ----------------------------------------------------------------

    private static final LocalDate WINDOW_FROM = LocalDate.of(2027, 1, 1);
    private static final LocalDate WINDOW_TO = LocalDate.of(2027, 12, 31);

    private Reservation persistReservation(String guestName, LocalDate checkIn,
                                           LocalDate checkOut, String status, String source) {
        Reservation r = new Reservation(property, guestName, checkIn, checkOut, status, source);
        r.setOrganizationId(orgId);
        return reservationRepository.save(r);
    }

    @Test
    void getReservationsPage_filtersStatusInSqlAndPaginates() {
        persistReservation("Alice Martin", LocalDate.of(2027, 6, 1), LocalDate.of(2027, 6, 4), "confirmed", "direct");
        persistReservation("Bob Durand", LocalDate.of(2027, 6, 10), LocalDate.of(2027, 6, 12), "pending", "direct");
        persistReservation("Chloe Petit", LocalDate.of(2027, 6, 20), LocalDate.of(2027, 6, 23), "confirmed", "airbnb");

        // Status en MAJUSCULES : normalise par le service, matche les valeurs stockees en minuscules
        Page<Reservation> page = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                "CONFIRMED", null, null, PageRequest.of(0, 1));

        assertEquals(2, page.getTotalElements(), "2 reservations confirmed attendues (filtre SQL)");
        assertEquals(2, page.getTotalPages());
        assertEquals(1, page.getContent().size(), "size=1 → une seule ligne par page");
        // Tri checkIn ASC : Alice avant Chloe
        assertEquals("Alice Martin", page.getContent().get(0).getGuestName());
    }

    @Test
    void getReservationsPage_searchMatchesGuestNamePropertyAndCode() {
        Reservation withCode = persistReservation("Alice Martin",
                LocalDate.of(2027, 7, 1), LocalDate.of(2027, 7, 4), "confirmed", "direct");
        withCode.setConfirmationCode("ZX-9481");
        reservationRepository.save(withCode);
        persistReservation("Bob Durand", LocalDate.of(2027, 7, 10), LocalDate.of(2027, 7, 12), "confirmed", "direct");

        // Nom de guest, insensible a la casse
        Page<Reservation> byGuest = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                null, null, "aLiCe", Pageable.unpaged());
        assertEquals(1, byGuest.getTotalElements());
        assertEquals("Alice Martin", byGuest.getContent().get(0).getGuestName());

        // Code de confirmation partiel
        Page<Reservation> byCode = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                null, null, "zx-94", Pageable.unpaged());
        assertEquals(1, byCode.getTotalElements());

        // Nom du logement → matche toutes les resas de la propriete
        Page<Reservation> byProperty = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                null, null, "appart reservation", Pageable.unpaged());
        assertEquals(2, byProperty.getTotalElements());
    }

    @Test
    void getReservationsPage_unpagedMatchesLegacyListShape() {
        persistReservation("Alice Martin", LocalDate.of(2027, 8, 1), LocalDate.of(2027, 8, 4), "confirmed", "direct");
        persistReservation("Bob Durand", LocalDate.of(2027, 8, 10), LocalDate.of(2027, 8, 12), "pending", "direct");

        // Sans filtre, unpaged = meme contenu et meme ordre que le flux legacy
        List<Reservation> legacy = reservationService.getReservations(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO);
        Page<Reservation> unpaged = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                null, null, null, Pageable.unpaged());

        assertEquals(legacy.size(), unpaged.getContent().size());
        for (int i = 0; i < legacy.size(); i++) {
            assertEquals(legacy.get(i).getId(), unpaged.getContent().get(i).getId());
        }

        // Filtre source en SQL (nouveau mode uniquement)
        Page<Reservation> bySource = reservationService.getReservationsPage(
                "kc-res-test", null, WINDOW_FROM, WINDOW_TO,
                null, "direct", null, Pageable.unpaged());
        assertEquals(2, bySource.getTotalElements());
    }
}
