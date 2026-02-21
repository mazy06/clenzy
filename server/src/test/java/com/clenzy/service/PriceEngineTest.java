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
}
