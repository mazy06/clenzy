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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'integration du PriceEngine avec une vraie base PostgreSQL.
 *
 * Verifie la resolution de prix sur des donnees reelles (overrides, rate plans)
 * persistees dans la base via Testcontainers.
 */
@Transactional
@Rollback
class PriceEngineIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private PriceEngine priceEngine;

    @Autowired
    private RateOverrideRepository rateOverrideRepository;

    @Autowired
    private RatePlanRepository ratePlanRepository;

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
        org = new Organization("Price Org", OrganizationType.INDIVIDUAL, "price-org");
        organizationRepository.save(org);
        orgId = org.getId();

        owner = new User("Sophie", "Durand", "sophie.price@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-price-test");
        userRepository.save(owner);

        property = new Property("Appart Tarif", "20 avenue Foch", 2, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("100.00"));
        propertyRepository.save(property);

        setupTenantContext(orgId, true);
    }

    // ----------------------------------------------------------------
    // 1. resolvePriceRange() avec overrides et rate plans en base
    // ----------------------------------------------------------------

    @Test
    void resolvePriceRange_realData() {
        LocalDate from = LocalDate.of(2027, 6, 1);
        LocalDate to = LocalDate.of(2027, 6, 5); // 4 jours [1,2,3,4)

        // Override sur le 1er juin : 300 EUR
        RateOverride override = new RateOverride(property, LocalDate.of(2027, 6, 1),
                new BigDecimal("300.00"), "MANUAL", orgId);
        rateOverrideRepository.save(override);

        // Rate plan SEASONAL couvrant toute la periode : 200 EUR
        RatePlan seasonal = new RatePlan(property, "Ete 2027", RatePlanType.SEASONAL,
                new BigDecimal("200.00"), orgId);
        seasonal.setStartDate(LocalDate.of(2027, 6, 1));
        seasonal.setEndDate(LocalDate.of(2027, 8, 31));
        seasonal.setPriority(100);
        seasonal.setIsActive(true);
        ratePlanRepository.save(seasonal);

        ratePlanRepository.flush();
        rateOverrideRepository.flush();

        // Resoudre les prix
        Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(
                property.getId(), from, to, orgId);

        assertEquals(4, prices.size());

        // 1er juin : override 300 EUR (priorite max)
        assertEquals(0, new BigDecimal("300.00").compareTo(prices.get(LocalDate.of(2027, 6, 1))),
                "Override doit avoir la priorite sur le rate plan");

        // 2, 3, 4 juin : seasonal 200 EUR
        assertEquals(0, new BigDecimal("200.00").compareTo(prices.get(LocalDate.of(2027, 6, 2))));
        assertEquals(0, new BigDecimal("200.00").compareTo(prices.get(LocalDate.of(2027, 6, 3))));
        assertEquals(0, new BigDecimal("200.00").compareTo(prices.get(LocalDate.of(2027, 6, 4))));
    }

    // ----------------------------------------------------------------
    // 2. PROMOTIONAL l'emporte sur SEASONAL en base
    // ----------------------------------------------------------------

    @Test
    void resolvePrice_promotional_overSeasonal_inDb() {
        LocalDate targetDate = LocalDate.of(2027, 7, 15);

        // Rate plan SEASONAL : 180 EUR
        RatePlan seasonal = new RatePlan(property, "Ete SEASONAL", RatePlanType.SEASONAL,
                new BigDecimal("180.00"), orgId);
        seasonal.setStartDate(LocalDate.of(2027, 7, 1));
        seasonal.setEndDate(LocalDate.of(2027, 7, 31));
        seasonal.setPriority(50);
        seasonal.setIsActive(true);
        ratePlanRepository.save(seasonal);

        // Rate plan PROMOTIONAL : 99 EUR (priorite TYPE plus haute que SEASONAL)
        RatePlan promo = new RatePlan(property, "Flash Sale", RatePlanType.PROMOTIONAL,
                new BigDecimal("99.00"), orgId);
        promo.setStartDate(LocalDate.of(2027, 7, 10));
        promo.setEndDate(LocalDate.of(2027, 7, 20));
        promo.setPriority(200);
        promo.setIsActive(true);
        ratePlanRepository.save(promo);

        ratePlanRepository.flush();

        BigDecimal price = priceEngine.resolvePrice(property.getId(), targetDate, orgId);

        assertNotNull(price);
        assertEquals(0, new BigDecimal("99.00").compareTo(price),
                "PROMOTIONAL doit l'emporter sur SEASONAL");
    }

    // ----------------------------------------------------------------
    // 3. Sans plans ni overrides → fallback sur property.nightlyPrice
    // ----------------------------------------------------------------

    @Test
    void resolvePrice_fallback_toPropertyPrice() {
        LocalDate date = LocalDate.of(2027, 9, 1);

        // Aucun override ni rate plan — fallback sur property.nightlyPrice
        BigDecimal price = priceEngine.resolvePrice(property.getId(), date, orgId);

        assertNotNull(price);
        assertEquals(0, new BigDecimal("100.00").compareTo(price),
                "Sans plan, le prix doit etre property.nightlyPrice");
    }
}
