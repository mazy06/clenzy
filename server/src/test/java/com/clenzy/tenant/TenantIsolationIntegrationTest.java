package com.clenzy.tenant;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.CalendarEngine;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'integration pour l'isolation multi-tenant.
 *
 * Verifie que :
 * - Les queries paramterees par orgId isolent correctement les donnees
 * - Un save cross-tenant est refuse par le service
 * - Un superAdmin peut requeter sans filtre org
 */
@Transactional
@Rollback
class TenantIsolationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CalendarEngine calendarEngine;

    @Autowired
    private CalendarDayRepository calendarDayRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private com.clenzy.service.ReservationService reservationService;

    private Organization org1;
    private Organization org2;
    private User owner1;
    private User owner2;
    private Property property1;
    private Property property2;
    private Long org1Id;
    private Long org2Id;

    @BeforeEach
    void createTestData() {
        // Organisation 1
        org1 = new Organization("Tenant Alpha", OrganizationType.INDIVIDUAL, "tenant-alpha");
        organizationRepository.save(org1);
        org1Id = org1.getId();

        owner1 = new User("Alice", "Alpha", "alice.tenant@test.com", "password123");
        owner1.setOrganizationId(org1Id);
        owner1.setKeycloakId("kc-alpha");
        userRepository.save(owner1);

        property1 = new Property("Prop Alpha", "1 rue Alpha", 2, 1, owner1);
        property1.setOrganizationId(org1Id);
        property1.setNightlyPrice(new BigDecimal("100.00"));
        propertyRepository.save(property1);

        // Organisation 2
        org2 = new Organization("Tenant Beta", OrganizationType.INDIVIDUAL, "tenant-beta");
        organizationRepository.save(org2);
        org2Id = org2.getId();

        owner2 = new User("Bob", "Beta", "bob.tenant@test.com", "password123");
        owner2.setOrganizationId(org2Id);
        owner2.setKeycloakId("kc-beta");
        userRepository.save(owner2);

        property2 = new Property("Prop Beta", "2 rue Beta", 3, 2, owner2);
        property2.setOrganizationId(org2Id);
        property2.setNightlyPrice(new BigDecimal("150.00"));
        propertyRepository.save(property2);
    }

    // ----------------------------------------------------------------
    // 1. Les queries filtrees par orgId isolent les donnees
    // ----------------------------------------------------------------

    @Test
    void tenantFilter_isolatesCalendarDays() {
        LocalDate checkIn = LocalDate.of(2027, 6, 1);
        LocalDate checkOut = LocalDate.of(2027, 6, 4);

        // Reserver sur property1 (org1)
        setupTenantContext(org1Id, true);
        calendarEngine.book(property1.getId(), checkIn, checkOut, null, org1Id, "MANUAL", "test-actor");

        // Reserver sur property2 (org2)
        setupTenantContext(org2Id, true);
        calendarEngine.book(property2.getId(), checkIn, checkOut, null, org2Id, "MANUAL", "test-actor");

        // Query avec org1Id → ne voit que ses propres jours
        List<CalendarDay> org1Days = calendarDayRepository.findByPropertyAndDateRange(
                property1.getId(), checkIn, checkOut.minusDays(1), org1Id);
        assertEquals(3, org1Days.size());
        org1Days.forEach(d -> assertEquals(org1Id, d.getOrganizationId()));

        // Query avec org2Id sur property1 → aucun resultat (mauvais orgId)
        List<CalendarDay> crossTenant = calendarDayRepository.findByPropertyAndDateRange(
                property1.getId(), checkIn, checkOut.minusDays(1), org2Id);
        assertTrue(crossTenant.isEmpty(),
                "Le query avec org2Id ne doit pas retourner les CalendarDays de org1");

        // Query avec org2Id sur property2 → voit ses propres jours
        List<CalendarDay> org2Days = calendarDayRepository.findByPropertyAndDateRange(
                property2.getId(), checkIn, checkOut.minusDays(1), org2Id);
        assertEquals(3, org2Days.size());
        org2Days.forEach(d -> assertEquals(org2Id, d.getOrganizationId()));
    }

    // ----------------------------------------------------------------
    // 2. Sauvegarder une reservation avec un orgId different → refuse
    // ----------------------------------------------------------------

    @Test
    void crossTenant_reservationRefused() {
        LocalDate checkIn = LocalDate.of(2027, 7, 10);
        LocalDate checkOut = LocalDate.of(2027, 7, 13);

        // Le tenant context est org1
        setupTenantContext(org1Id, false);

        // La reservation a un orgId different (org2)
        Reservation crossTenantRes = new Reservation(property2, "Cross Guest",
                checkIn, checkOut, "confirmed", "MANUAL");
        crossTenantRes.setOrganizationId(org2Id);

        // save() doit refuser car reservation.orgId != tenantContext.orgId
        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                reservationService.save(crossTenantRes));

        assertTrue(ex.getMessage().contains("Acces refuse") || ex.getMessage().contains("organisation"),
                "Le message d'erreur doit mentionner l'acces refuse ou l'organisation");
    }

    // ----------------------------------------------------------------
    // 3. SuperAdmin voit les proprietes de toutes les orgs
    // ----------------------------------------------------------------

    @Test
    void superAdmin_seesAllProperties() {
        // En mode superAdmin, on peut requeter les proprietes de toutes les orgs
        setupTenantContext(null, true);

        // findById ne filtre pas par org (pas de @Query parametree par orgId)
        assertTrue(propertyRepository.findById(property1.getId()).isPresent(),
                "SuperAdmin doit voir la propriete de org1");
        assertTrue(propertyRepository.findById(property2.getId()).isPresent(),
                "SuperAdmin doit voir la propriete de org2");

        // Les CalendarDays sont filtrees par orgId dans le query, pas par Hibernate filter
        // Donc il faut passer l'orgId explicitement. Testons avec les deux.
        LocalDate checkIn = LocalDate.of(2027, 8, 1);
        LocalDate checkOut = LocalDate.of(2027, 8, 3);

        calendarEngine.book(property1.getId(), checkIn, checkOut, null, org1Id, "MANUAL", "admin");
        calendarEngine.book(property2.getId(), checkIn, checkOut, null, org2Id, "MANUAL", "admin");

        List<CalendarDay> days1 = calendarDayRepository.findByPropertyAndDateRange(
                property1.getId(), checkIn, checkOut.minusDays(1), org1Id);
        List<CalendarDay> days2 = calendarDayRepository.findByPropertyAndDateRange(
                property2.getId(), checkIn, checkOut.minusDays(1), org2Id);

        assertEquals(2, days1.size(), "SuperAdmin voit les jours de org1");
        assertEquals(2, days2.size(), "SuperAdmin voit les jours de org2");
    }
}
