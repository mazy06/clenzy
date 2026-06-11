package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PriceEngineTest {

    @Mock
    private RateOverrideRepository rateOverrideRepository;

    @Mock
    private RatePlanRepository ratePlanRepository;

    @Mock
    private PropertyRepository propertyRepository;

    @InjectMocks
    private PriceEngine priceEngine;

    private Long propertyId;
    private Long orgId;
    private LocalDate date;

    @BeforeEach
    void setUp() {
        propertyId = 1L;
        orgId = 1L;
        date = LocalDate.of(2025, 6, 15);
    }

    @Test
    void resolvePrice_override_takesPriority() {
        RateOverride override = new RateOverride();
        override.setDate(date);
        override.setNightlyPrice(new BigDecimal("250.00"));

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.of(override));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        assertEquals(new BigDecimal("250.00"), result);
        verify(rateOverrideRepository).findByPropertyIdAndDate(propertyId, date, orgId);
        // Should not check rate plans or property when override exists
        verify(ratePlanRepository, never()).findActiveByPropertyId(anyLong(), anyLong());
    }

    @Test
    void resolvePrice_promotional_overSeasonal() {
        RatePlan promotional = new RatePlan();
        promotional.setType(RatePlanType.PROMOTIONAL);
        promotional.setPriority(300);
        promotional.setNightlyPrice(new BigDecimal("180.00"));
        promotional.setIsActive(true);
        promotional.setStartDate(date.minusDays(1));
        promotional.setEndDate(date.plusDays(1));

        RatePlan seasonal = new RatePlan();
        seasonal.setType(RatePlanType.SEASONAL);
        seasonal.setPriority(200);
        seasonal.setNightlyPrice(new BigDecimal("220.00"));
        seasonal.setIsActive(true);
        seasonal.setStartDate(date.minusDays(1));
        seasonal.setEndDate(date.plusDays(1));

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(seasonal, promotional));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        assertEquals(new BigDecimal("180.00"), result);
    }

    @Test
    void resolvePrice_seasonal_overBase() {
        RatePlan seasonal = new RatePlan();
        seasonal.setType(RatePlanType.SEASONAL);
        seasonal.setPriority(200);
        seasonal.setNightlyPrice(new BigDecimal("220.00"));
        seasonal.setIsActive(true);
        seasonal.setStartDate(date.minusDays(1));
        seasonal.setEndDate(date.plusDays(1));

        RatePlan base = new RatePlan();
        base.setType(RatePlanType.BASE);
        base.setPriority(100);
        base.setNightlyPrice(new BigDecimal("150.00"));
        base.setIsActive(true);
        base.setStartDate(date.minusDays(1));
        base.setEndDate(date.plusDays(1));

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(base, seasonal));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        assertEquals(new BigDecimal("220.00"), result);
    }

    @Test
    void resolvePrice_fallback_propertyPrice() {
        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(new BigDecimal("100.00"));

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of());
        when(propertyRepository.findById(propertyId))
                .thenReturn(Optional.of(property));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        assertEquals(new BigDecimal("100.00"), result);
        verify(propertyRepository).findById(propertyId);
    }

    @Test
    void resolvePrice_noPrice_returnsNull() {
        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(null);

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of());
        when(propertyRepository.findById(propertyId))
                .thenReturn(Optional.of(property));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        assertNull(result);
    }

    @Test
    void resolvePriceRange_mixOverridesAndPlans() {
        LocalDate from = LocalDate.of(2025, 6, 1);
        LocalDate to = LocalDate.of(2025, 6, 4); // [Jun 1, Jun 4) = 3 days

        // Day 1 (Jun 1): Override
        RateOverride override1 = new RateOverride();
        override1.setDate(from);
        override1.setNightlyPrice(new BigDecimal("300.00"));

        // Day 2 (Jun 2): Plan applies (active, date in range for Jun 2 only)
        RatePlan plan = new RatePlan();
        plan.setType(RatePlanType.SEASONAL);
        plan.setPriority(200);
        plan.setNightlyPrice(new BigDecimal("200.00"));
        plan.setIsActive(true);
        // Plan applies only to Jun 2 (from.plusDays(1))
        plan.setStartDate(from.plusDays(1));
        plan.setEndDate(from.plusDays(1));

        // Day 3 (Jun 3): Fallback to property
        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(new BigDecimal("150.00"));

        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
                .thenReturn(List.of(override1));
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(plan));
        when(propertyRepository.findById(propertyId))
                .thenReturn(Optional.of(property));

        Map<LocalDate, BigDecimal> result = priceEngine.resolvePriceRange(propertyId, from, to, orgId);

        assertEquals(3, result.size());
        assertEquals(new BigDecimal("300.00"), result.get(from));           // override
        assertEquals(new BigDecimal("200.00"), result.get(from.plusDays(1))); // plan
        assertEquals(new BigDecimal("150.00"), result.get(from.plusDays(2))); // fallback
    }

    @Test
    void resolvePriceRange_batchOptimized() {
        LocalDate from = LocalDate.of(2025, 6, 1);
        LocalDate to = LocalDate.of(2025, 6, 4); // [Jun 1, Jun 4) = 3 days

        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(new BigDecimal("150.00"));

        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
                .thenReturn(List.of());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of());
        when(propertyRepository.findById(propertyId))
                .thenReturn(Optional.of(property));

        priceEngine.resolvePriceRange(propertyId, from, to, orgId);

        // Verify batch methods called once each, not once per day
        verify(rateOverrideRepository, times(1)).findByPropertyIdAndDateRange(propertyId, from, to, orgId);
        verify(ratePlanRepository, times(1)).findActiveByPropertyId(propertyId, orgId);
        verify(propertyRepository, atMostOnce()).findById(propertyId);
    }

    @Test
    void resolvePrice_planDoesNotApply_skipped() {
        // Plan does not apply to the test date (dates outside range)
        RatePlan plan = new RatePlan();
        plan.setType(RatePlanType.SEASONAL);
        plan.setPriority(200);
        plan.setNightlyPrice(new BigDecimal("200.00"));
        plan.setIsActive(true);
        plan.setStartDate(date.plusDays(10));
        plan.setEndDate(date.plusDays(20));

        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(new BigDecimal("100.00"));

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
                .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(plan));
        when(propertyRepository.findById(propertyId))
                .thenReturn(Optional.of(property));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);

        // Should fall back to property price since plan doesn't apply
        assertEquals(new BigDecimal("100.00"), result);
    }

    // ─── Phase 5 audit : tests pour les types ajoutes dans TYPE_PRIORITY ─────
    // (WEEKEND, EVENT, EARLY_BIRD)

    /** Helper : RatePlan minimal active sans contraintes de date. */
    private RatePlan plan(RatePlanType type, BigDecimal price, int priority) {
        RatePlan rp = new RatePlan();
        rp.setType(type);
        rp.setNightlyPrice(price);
        rp.setPriority(priority);
        rp.setIsActive(true);
        return rp;
    }

    @Test
    void resolvePrice_WEEKEND_beats_BASE_when_both_apply() {
        Property property = new Property();
        property.setId(propertyId);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
            .thenReturn(Optional.empty());
        // BASE plan + WEEKEND plan, les 2 actifs sans contrainte date/dow
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.BASE, new BigDecimal("80.00"), 0),
                plan(RatePlanType.WEEKEND, new BigDecimal("120.00"), 10)
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);
        // WEEKEND est plus haut dans TYPE_PRIORITY → 120 gagne
        assertEquals(new BigDecimal("120.00"), result);
    }

    @Test
    void resolvePrice_EVENT_beats_WEEKEND_beats_SEASONAL() {
        Property property = new Property();
        property.setId(propertyId);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.SEASONAL, new BigDecimal("150.00"), 0),
                plan(RatePlanType.WEEKEND, new BigDecimal("130.00"), 0),
                plan(RatePlanType.EVENT, new BigDecimal("250.00"), 0)
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);
        // EVENT > WEEKEND > SEASONAL → 250 gagne
        assertEquals(new BigDecimal("250.00"), result);
    }

    @Test
    void resolvePrice_EARLY_BIRD_beats_LAST_MINUTE() {
        // Sejour dans 40 jours : EARLY_BIRD (fenetre par defaut >= 30j) applicable,
        // LAST_MINUTE rendu applicable via une borne explicite maxLeadDays
        LocalDate stayDate = LocalDate.now().plusDays(40);
        RatePlan lastMinute = plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0);
        lastMinute.setMaxLeadDays(60);

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                lastMinute,
                plan(RatePlanType.EARLY_BIRD, new BigDecimal("60.00"), 0)
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);
        // EARLY_BIRD avant LAST_MINUTE dans TYPE_PRIORITY → 60 gagne
        assertEquals(new BigDecimal("60.00"), result);
    }

    @Test
    void resolvePrice_PROMOTIONAL_beats_EVENT() {
        Property property = new Property();
        property.setId(propertyId);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.EVENT, new BigDecimal("250.00"), 100),
                plan(RatePlanType.PROMOTIONAL, new BigDecimal("50.00"), 0)
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId);
        // PROMOTIONAL reste tout en haut, meme avec priority basse vs EVENT priority 100
        // (le tri par priorite est INTRA-type, pas inter-type)
        assertEquals(new BigDecimal("50.00"), result);
    }

    @Test
    void resolvePrice_WEEKEND_with_dow_filter_friday_matches() {
        Property property = new Property();
        property.setId(propertyId);
        // Vendredi 13 juin 2025 (DayOfWeek=5)
        LocalDate friday = LocalDate.of(2025, 6, 13);
        RatePlan weekend = plan(RatePlanType.WEEKEND, new BigDecimal("120.00"), 0);
        weekend.setDaysOfWeek(new Integer[] { 5, 6, 7 });

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, friday, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.BASE, new BigDecimal("80.00"), 0),
                weekend
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, friday, orgId);
        assertEquals(new BigDecimal("120.00"), result);
    }

    @Test
    void resolvePrice_WEEKEND_with_dow_filter_monday_does_not_match() {
        Property property = new Property();
        property.setId(propertyId);
        // Lundi 16 juin 2025 (DayOfWeek=1)
        LocalDate monday = LocalDate.of(2025, 6, 16);
        RatePlan weekend = plan(RatePlanType.WEEKEND, new BigDecimal("120.00"), 0);
        weekend.setDaysOfWeek(new Integer[] { 5, 6, 7 });

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, monday, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.BASE, new BigDecimal("80.00"), 0),
                weekend
            ));

        BigDecimal result = priceEngine.resolvePrice(propertyId, monday, orgId);
        // Lundi ne matche pas le filtre [5,6,7] → fallback sur BASE
        assertEquals(new BigDecimal("80.00"), result);
    }

    // ─── Audit Z5-BUGS-05 : evaluation du lead time (LAST_MINUTE / EARLY_BIRD) ─

    @Test
    void whenLastMinutePlanWithoutLeadConfig_andStayFarAhead_thenPlanIsIgnored() {
        // Arrange : sejour dans 30 jours, plan LAST_MINUTE sans lead time configure
        LocalDate stayDate = LocalDate.now().plusDays(30);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0),
                plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)
            ));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert : fenetre par defaut (<= 7 jours) → LAST_MINUTE ecarte, BASE gagne
        assertEquals(new BigDecimal("100.00"), result);
    }

    @Test
    void whenLastMinutePlanWithoutLeadConfig_andStayWithinDefaultWindow_thenPlanApplies() {
        // Arrange : sejour dans 3 jours (dans la fenetre par defaut de 7 jours)
        LocalDate stayDate = LocalDate.now().plusDays(3);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0),
                plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)
            ));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert : prix brade applique dans sa fenetre metier
        assertEquals(new BigDecimal("70.00"), result);
    }

    @Test
    void whenLastMinutePlanWithExplicitMaxLeadDays_andStayBeyond_thenPlanIsIgnored() {
        // Arrange : maxLeadDays=14, sejour dans 20 jours → hors fenetre
        LocalDate stayDate = LocalDate.now().plusDays(20);
        RatePlan lastMinute = plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0);
        lastMinute.setMaxLeadDays(14);

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(lastMinute, plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert
        assertEquals(new BigDecimal("100.00"), result);
    }

    @Test
    void whenLastMinutePlanWithExplicitMaxLeadDays_andStayWithin_thenPlanApplies() {
        // Arrange : maxLeadDays=14, sejour dans 10 jours → dans la fenetre
        LocalDate stayDate = LocalDate.now().plusDays(10);
        RatePlan lastMinute = plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0);
        lastMinute.setMaxLeadDays(14);

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(lastMinute, plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert
        assertEquals(new BigDecimal("70.00"), result);
    }

    @Test
    void whenEarlyBirdPlanWithoutLeadConfig_andStayClose_thenPlanIsIgnored() {
        // Arrange : sejour dans 5 jours, EARLY_BIRD sans lead time configure
        // (fenetre par defaut >= 30 jours)
        LocalDate stayDate = LocalDate.now().plusDays(5);
        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.EARLY_BIRD, new BigDecimal("60.00"), 0),
                plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)
            ));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert
        assertEquals(new BigDecimal("100.00"), result);
    }

    @Test
    void whenEarlyBirdPlanWithExplicitMinLeadDays_andStayFarEnough_thenPlanApplies() {
        // Arrange : minLeadDays=60, sejour dans 90 jours
        LocalDate stayDate = LocalDate.now().plusDays(90);
        RatePlan earlyBird = plan(RatePlanType.EARLY_BIRD, new BigDecimal("60.00"), 0);
        earlyBird.setMinLeadDays(60);

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, stayDate, orgId))
            .thenReturn(Optional.empty());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(earlyBird, plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, stayDate, orgId);

        // Assert
        assertEquals(new BigDecimal("60.00"), result);
    }

    @Test
    void whenLeadTimeWindowApplies_thenRangeResolutionMatchesSingleDateResolution() {
        // Arrange : plage couvrant l'interieur ET l'exterieur de la fenetre par defaut
        LocalDate from = LocalDate.now().plusDays(6);
        LocalDate to = LocalDate.now().plusDays(10); // [now+6, now+10)
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
            .thenReturn(List.of());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.LAST_MINUTE, new BigDecimal("70.00"), 0),
                plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)
            ));

        // Act
        Map<LocalDate, BigDecimal> result = priceEngine.resolvePriceRange(propertyId, from, to, orgId);

        // Assert : jours <= now+7 brades, au-dela prix BASE
        assertEquals(new BigDecimal("70.00"), result.get(LocalDate.now().plusDays(6)));
        assertEquals(new BigDecimal("70.00"), result.get(LocalDate.now().plusDays(7)));
        assertEquals(new BigDecimal("100.00"), result.get(LocalDate.now().plusDays(8)));
        assertEquals(new BigDecimal("100.00"), result.get(LocalDate.now().plusDays(9)));
    }

    // ─── Audit Z5-BUGS-02 : exclusion d'overrides par source ─────────────────

    @Test
    void whenOverrideSourceIsExcluded_thenResolutionFallsBackToPlans() {
        // Arrange : override YIELD_RULE present mais exclu de la resolution
        RateOverride yieldOverride = new RateOverride();
        yieldOverride.setDate(date);
        yieldOverride.setNightlyPrice(new BigDecimal("90.00"));
        yieldOverride.setSource("YIELD_RULE");

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
            .thenReturn(Optional.of(yieldOverride));
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(plan(RatePlanType.BASE, new BigDecimal("100.00"), 0)));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId, Set.of("YIELD_RULE"));

        // Assert : le prix de base est retourne, pas l'override yield
        assertEquals(new BigDecimal("100.00"), result);
    }

    @Test
    void whenOverrideSourceIsNotExcluded_thenOverrideStillWins() {
        // Arrange : override MANUAL, exclusion limitee a YIELD_RULE
        RateOverride manualOverride = new RateOverride();
        manualOverride.setDate(date);
        manualOverride.setNightlyPrice(new BigDecimal("180.00"));
        manualOverride.setSource("MANUAL");

        when(rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId))
            .thenReturn(Optional.of(manualOverride));

        // Act
        BigDecimal result = priceEngine.resolvePrice(propertyId, date, orgId, Set.of("YIELD_RULE"));

        // Assert : le prix manuel reste prioritaire (audit Z5-BUGS-04)
        assertEquals(new BigDecimal("180.00"), result);
    }

    // ─── Audit T-ARCH-04 : resolution avec source (cascade unique) ───────────

    @Test
    void whenEventPlanWins_thenResolvedSourceIsEVENT() {
        // Arrange : EVENT etait absent de la copie divergente du controller
        LocalDate from = date;
        LocalDate to = date.plusDays(1);
        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
            .thenReturn(List.of());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId))
            .thenReturn(List.of(
                plan(RatePlanType.SEASONAL, new BigDecimal("150.00"), 0),
                plan(RatePlanType.EVENT, new BigDecimal("250.00"), 0)
            ));

        // Act
        Map<LocalDate, PriceEngine.ResolvedPrice> result =
                priceEngine.resolvePriceRangeWithSource(propertyId, from, to, orgId);

        // Assert
        assertEquals(new BigDecimal("250.00"), result.get(date).price());
        assertEquals("EVENT", result.get(date).source());
    }

    @Test
    void whenOverrideExists_thenResolvedSourceIsOVERRIDE() {
        LocalDate from = date;
        LocalDate to = date.plusDays(1);
        RateOverride override = new RateOverride();
        override.setDate(date);
        override.setNightlyPrice(new BigDecimal("300.00"));

        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
            .thenReturn(List.of(override));
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId)).thenReturn(List.of());

        Map<LocalDate, PriceEngine.ResolvedPrice> result =
                priceEngine.resolvePriceRangeWithSource(propertyId, from, to, orgId);

        assertEquals(new BigDecimal("300.00"), result.get(date).price());
        assertEquals(PriceEngine.SOURCE_OVERRIDE, result.get(date).source());
    }

    @Test
    void whenNoPlanApplies_thenResolvedSourceIsPropertyDefault() {
        LocalDate from = date;
        LocalDate to = date.plusDays(1);
        Property property = new Property();
        property.setId(propertyId);
        property.setNightlyPrice(new BigDecimal("100.00"));

        when(rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId))
            .thenReturn(List.of());
        when(ratePlanRepository.findActiveByPropertyId(propertyId, orgId)).thenReturn(List.of());
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));

        Map<LocalDate, PriceEngine.ResolvedPrice> result =
                priceEngine.resolvePriceRangeWithSource(propertyId, from, to, orgId);

        assertEquals(new BigDecimal("100.00"), result.get(date).price());
        assertEquals(PriceEngine.SOURCE_PROPERTY_DEFAULT, result.get(date).source());
    }
}
