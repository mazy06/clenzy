package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
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
}
