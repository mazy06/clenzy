package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'integration du RestrictionEngine avec une vraie base PostgreSQL.
 *
 * Verifie que les BookingRestrictions persistees en base sont correctement
 * chargees et evaluees par le RestrictionEngine.
 */
@Transactional
@Rollback
class RestrictionEngineIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private RestrictionEngine restrictionEngine;

    @Autowired
    private BookingRestrictionRepository bookingRestrictionRepository;

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
        org = new Organization("Restriction Org", OrganizationType.INDIVIDUAL, "restriction-org");
        organizationRepository.save(org);
        orgId = org.getId();

        owner = new User("Claire", "Moreau", "claire.restr@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-restr-test");
        userRepository.save(owner);

        property = new Property("Appart Restricted", "15 rue Rivoli", 2, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("90.00"));
        propertyRepository.save(property);

        setupTenantContext(orgId, true);
    }

    // ----------------------------------------------------------------
    // 1. Restriction minStay insertee en base → validate retourne des violations
    // ----------------------------------------------------------------

    @Test
    void validate_restrictionsFromDb() {
        // Restriction : sejour minimum 3 nuits du 1er au 31 aout
        BookingRestriction restriction = new BookingRestriction(
                property,
                LocalDate.of(2027, 8, 1),
                LocalDate.of(2027, 8, 31),
                orgId
        );
        restriction.setMinStay(3);
        restriction.setPriority(100);
        bookingRestrictionRepository.save(restriction);
        bookingRestrictionRepository.flush();

        // Tenter une reservation de 1 nuit → violation minStay
        LocalDate checkIn = LocalDate.of(2027, 8, 10);
        LocalDate checkOut = LocalDate.of(2027, 8, 11); // 1 nuit

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(
                property.getId(), checkIn, checkOut, orgId);

        assertFalse(result.isValid(), "La reservation de 1 nuit doit violer le minStay de 3");
        assertFalse(result.getViolations().isEmpty());
        assertTrue(result.getViolations().get(0).contains("3"),
                "Le message doit mentionner le minimum de 3 nuits");

        // Tenter une reservation de 4 nuits → OK
        LocalDate checkIn2 = LocalDate.of(2027, 8, 15);
        LocalDate checkOut2 = LocalDate.of(2027, 8, 19); // 4 nuits

        RestrictionEngine.ValidationResult result2 = restrictionEngine.validate(
                property.getId(), checkIn2, checkOut2, orgId);

        assertTrue(result2.isValid(), "La reservation de 4 nuits doit respecter le minStay de 3");
    }

    // ----------------------------------------------------------------
    // 2. Deux restrictions chevauchantes → la plus haute priorite s'applique
    // ----------------------------------------------------------------

    @Test
    void validate_highestPriority_fromDb() {
        // Restriction basse priorite : minStay 2 nuits (priorite 50)
        BookingRestriction lowPriority = new BookingRestriction(
                property,
                LocalDate.of(2027, 9, 1),
                LocalDate.of(2027, 9, 30),
                orgId
        );
        lowPriority.setMinStay(2);
        lowPriority.setPriority(50);
        bookingRestrictionRepository.save(lowPriority);

        // Restriction haute priorite : minStay 5 nuits (priorite 200)
        BookingRestriction highPriority = new BookingRestriction(
                property,
                LocalDate.of(2027, 9, 10),
                LocalDate.of(2027, 9, 20),
                orgId
        );
        highPriority.setMinStay(5);
        highPriority.setPriority(200);
        bookingRestrictionRepository.save(highPriority);

        bookingRestrictionRepository.flush();

        // Reservation de 3 nuits dans la zone de chevauchement
        // Le minStay 5 de la haute priorite doit s'appliquer
        LocalDate checkIn = LocalDate.of(2027, 9, 12);
        LocalDate checkOut = LocalDate.of(2027, 9, 15); // 3 nuits

        RestrictionEngine.ValidationResult result = restrictionEngine.validate(
                property.getId(), checkIn, checkOut, orgId);

        assertFalse(result.isValid(),
                "3 nuits doivent violer le minStay de 5 (haute priorite)");
        assertTrue(result.getViolations().get(0).contains("5"),
                "Le message doit mentionner le minimum de 5 nuits (haute priorite)");

        // Reservation de 6 nuits → OK meme avec la haute priorite
        LocalDate checkIn2 = LocalDate.of(2027, 9, 12);
        LocalDate checkOut2 = LocalDate.of(2027, 9, 18); // 6 nuits

        RestrictionEngine.ValidationResult result2 = restrictionEngine.validate(
                property.getId(), checkIn2, checkOut2, orgId);

        assertTrue(result2.isValid(), "6 nuits doivent respecter le minStay de 5");
    }
}
