package com.clenzy.service;

import com.clenzy.dto.rate.RateCalendarDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdvancedRateManagerTest {

    @Mock private PriceEngine priceEngine;
    @Mock private ChannelRateModifierRepository channelRateModifierRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private YieldRuleRepository yieldRuleRepository;
    @Mock private RateAuditLogRepository rateAuditLogRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ObjectMapper objectMapper;

    private AdvancedRateManager advancedRateManager;

    // Test fixtures
    private static final Long PROPERTY_ID = 42L;
    private static final Long ORG_ID = 1L;
    private static final LocalDate DATE = LocalDate.of(2025, 7, 15);
    private static final BigDecimal BASE_PRICE = new BigDecimal("100.00");

    @BeforeEach
    void setUp() {
        advancedRateManager = new AdvancedRateManager(
                priceEngine,
                channelRateModifierRepository,
                lengthOfStayDiscountRepository,
                occupancyPricingRepository,
                yieldRuleRepository,
                rateAuditLogRepository,
                rateOverrideRepository,
                propertyRepository,
                objectMapper
        );
    }

    // -- Helper methods -------------------------------------------------------

    private ChannelRateModifier percentageModifier(BigDecimal value, boolean active) {
        ChannelRateModifier modifier = new ChannelRateModifier();
        modifier.setModifierType(ChannelRateModifier.ModifierType.PERCENTAGE);
        modifier.setModifierValue(value);
        modifier.setActive(active);
        modifier.setChannelName(ChannelName.BOOKING);
        return modifier;
    }

    private ChannelRateModifier fixedModifier(BigDecimal value, boolean active) {
        ChannelRateModifier modifier = new ChannelRateModifier();
        modifier.setModifierType(ChannelRateModifier.ModifierType.FIXED_AMOUNT);
        modifier.setModifierValue(value);
        modifier.setActive(active);
        modifier.setChannelName(ChannelName.BOOKING);
        return modifier;
    }

    private ChannelRateModifier expiredModifier() {
        ChannelRateModifier modifier = percentageModifier(new BigDecimal("10"), true);
        modifier.setStartDate(DATE.minusDays(30));
        modifier.setEndDate(DATE.minusDays(1));
        return modifier;
    }

    private LengthOfStayDiscount losDiscount(LengthOfStayDiscount.DiscountType type,
                                              BigDecimal value, int minNights) {
        LengthOfStayDiscount discount = new LengthOfStayDiscount();
        discount.setDiscountType(type);
        discount.setDiscountValue(value);
        discount.setMinNights(minNights);
        discount.setActive(true);
        return discount;
    }

    private OccupancyPricing occupancyPricing(int baseOccupancy, BigDecimal extraFee, int maxOcc) {
        OccupancyPricing pricing = new OccupancyPricing();
        pricing.setBaseOccupancy(baseOccupancy);
        pricing.setExtraGuestFee(extraFee);
        pricing.setMaxOccupancy(maxOcc);
        pricing.setActive(true);
        return pricing;
    }

    // =========================================================================
    // resolveChannelPrice
    // =========================================================================

    @Nested
    @DisplayName("resolveChannelPrice")
    class ResolveChannelPriceTests {

        @Test
        @DisplayName("with no modifier returns base price unchanged")
        void resolveChannelPrice_withNoModifier_returnsBasePrice() {
            // Arrange
            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of());

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert
            assertThat(result).isEqualByComparingTo("100.00");
        }

        @Test
        @DisplayName("with percentage modifier applies discount correctly")
        void resolveChannelPrice_withPercentageModifier_appliesDiscount() {
            // Arrange: +10% on base price of 100 => 110
            ChannelRateModifier modifier = percentageModifier(new BigDecimal("10"), true);

            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(modifier));

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert: 100 + (100 * 10 / 100) = 110
            assertThat(result).isEqualByComparingTo("110.00");
        }

        @Test
        @DisplayName("with fixed modifier applies discount correctly")
        void resolveChannelPrice_withFixedModifier_appliesDiscount() {
            // Arrange: -15 EUR fixed => 85
            ChannelRateModifier modifier = fixedModifier(new BigDecimal("-15"), true);

            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(modifier));

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert: 100 + (-15) = 85
            assertThat(result).isEqualByComparingTo("85.00");
        }

        @Test
        @DisplayName("with multiple modifiers applies all in order")
        void resolveChannelPrice_withMultipleModifiers_appliesAll() {
            // Arrange: +10% then +5 fixed
            ChannelRateModifier pctModifier = percentageModifier(new BigDecimal("10"), true);
            ChannelRateModifier fixMod = fixedModifier(new BigDecimal("5"), true);

            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(pctModifier, fixMod));

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert: (100 + 10) + 5 = 115
            assertThat(result).isEqualByComparingTo("115.00");
        }

        @Test
        @DisplayName("with inactive modifier ignores it")
        void resolveChannelPrice_withInactiveModifier_ignoresIt() {
            // Arrange: inactive modifier should be skipped
            ChannelRateModifier modifier = percentageModifier(new BigDecimal("20"), false);

            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(modifier));

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert: inactive modifier not applied, price unchanged
            assertThat(result).isEqualByComparingTo("100.00");
        }

        @Test
        @DisplayName("with expired modifier ignores it")
        void resolveChannelPrice_withExpiredModifier_ignoresIt() {
            // Arrange: modifier ended yesterday
            ChannelRateModifier modifier = expiredModifier();

            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(modifier));

            // Act
            BigDecimal result = advancedRateManager.resolveChannelPrice(PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            // Assert: expired modifier not applied, price unchanged
            assertThat(result).isEqualByComparingTo("100.00");
        }
    }

    // =========================================================================
    // resolveChannelPriceRange
    // =========================================================================

    @Nested
    @DisplayName("resolveChannelPriceRange")
    class ResolveChannelPriceRangeTests {

        @Test
        @DisplayName("returns correct prices per day")
        void resolveChannelPriceRange_returnsCorrectPricesPerDay() {
            // Arrange: 3-day range with +10% modifier
            LocalDate from = DATE;
            LocalDate to = DATE.plusDays(3);

            Map<LocalDate, BigDecimal> basePrices = new LinkedHashMap<>();
            basePrices.put(DATE, new BigDecimal("100.00"));
            basePrices.put(DATE.plusDays(1), new BigDecimal("120.00"));
            basePrices.put(DATE.plusDays(2), new BigDecimal("80.00"));

            ChannelRateModifier modifier = percentageModifier(new BigDecimal("10"), true);

            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID)).thenReturn(basePrices);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of(modifier));

            // Act
            Map<LocalDate, BigDecimal> result = advancedRateManager.resolveChannelPriceRange(
                    PROPERTY_ID, from, to, ChannelName.BOOKING, ORG_ID);

            // Assert: each day +10%
            assertThat(result).hasSize(3);
            assertThat(result.get(DATE)).isEqualByComparingTo("110.00");
            assertThat(result.get(DATE.plusDays(1))).isEqualByComparingTo("132.00");
            assertThat(result.get(DATE.plusDays(2))).isEqualByComparingTo("88.00");
        }
    }

    // =========================================================================
    // getRateCalendar
    // =========================================================================

    @Nested
    @DisplayName("getRateCalendar")
    class GetRateCalendarTests {

        @Test
        @DisplayName("returns all channel prices for each day")
        void getRateCalendar_returnsAllChannelPrices() {
            // Arrange
            LocalDate from = DATE;
            LocalDate to = DATE.plusDays(2);

            Map<LocalDate, BigDecimal> basePrices = new LinkedHashMap<>();
            basePrices.put(DATE, new BigDecimal("100.00"));
            basePrices.put(DATE.plusDays(1), new BigDecimal("120.00"));

            ChannelRateModifier bookingModifier = percentageModifier(new BigDecimal("10"), true);
            bookingModifier.setChannelName(ChannelName.BOOKING);

            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID)).thenReturn(basePrices);
            when(channelRateModifierRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(bookingModifier));
            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());

            // Act
            List<RateCalendarDto> calendar = advancedRateManager.getRateCalendar(PROPERTY_ID, from, to, ORG_ID);

            // Assert
            assertThat(calendar).hasSize(2);

            RateCalendarDto day1 = calendar.get(0);
            assertThat(day1.date()).isEqualTo(DATE);
            assertThat(day1.basePrice()).isEqualByComparingTo("100.00");
            assertThat(day1.channelPrices()).containsKey(ChannelName.BOOKING);
            assertThat(day1.channelPrices().get(ChannelName.BOOKING)).isEqualByComparingTo("110.00");

            RateCalendarDto day2 = calendar.get(1);
            assertThat(day2.date()).isEqualTo(DATE.plusDays(1));
            assertThat(day2.basePrice()).isEqualByComparingTo("120.00");
            assertThat(day2.channelPrices().get(ChannelName.BOOKING)).isEqualByComparingTo("132.00");
        }
    }

    // =========================================================================
    // calculateLosDiscount
    // =========================================================================

    @Nested
    @DisplayName("calculateLosDiscount")
    class CalculateLosDiscountTests {

        @Test
        @DisplayName("percentage discount for 7 nights")
        void calculateLosDiscount_percentage_7nights() {
            // Arrange: 10% off for 7+ nights, total base = 700
            LengthOfStayDiscount discount = losDiscount(
                    LengthOfStayDiscount.DiscountType.PERCENTAGE,
                    new BigDecimal("10"),
                    7
            );
            BigDecimal totalBase = new BigDecimal("700.00");

            when(lengthOfStayDiscountRepository.findApplicable(PROPERTY_ID, 7, ORG_ID))
                    .thenReturn(List.of(discount));

            // Act
            BigDecimal result = advancedRateManager.calculateLosDiscount(PROPERTY_ID, 7, totalBase, ORG_ID);

            // Assert: 700 * 10 / 100 = 70
            assertThat(result).isEqualByComparingTo("70.00");
        }

        @Test
        @DisplayName("fixed per night discount for 14 nights")
        void calculateLosDiscount_fixedPerNight_14nights() {
            // Arrange: -5 EUR/night for 14+ nights
            LengthOfStayDiscount discount = losDiscount(
                    LengthOfStayDiscount.DiscountType.FIXED_PER_NIGHT,
                    new BigDecimal("5.00"),
                    14
            );
            BigDecimal totalBase = new BigDecimal("1400.00");

            when(lengthOfStayDiscountRepository.findApplicable(PROPERTY_ID, 14, ORG_ID))
                    .thenReturn(List.of(discount));

            // Act
            BigDecimal result = advancedRateManager.calculateLosDiscount(PROPERTY_ID, 14, totalBase, ORG_ID);

            // Assert: 5 * 14 = 70
            assertThat(result).isEqualByComparingTo("70.00");
        }

        @Test
        @DisplayName("no applicable discount returns zero")
        void calculateLosDiscount_noApplicableDiscount_returnsZero() {
            // Arrange
            BigDecimal totalBase = new BigDecimal("300.00");

            when(lengthOfStayDiscountRepository.findApplicable(PROPERTY_ID, 2, ORG_ID))
                    .thenReturn(List.of());

            // Act
            BigDecimal result = advancedRateManager.calculateLosDiscount(PROPERTY_ID, 2, totalBase, ORG_ID);

            // Assert
            assertThat(result).isEqualByComparingTo("0");
        }
    }

    // =========================================================================
    // calculateOccupancyAdjustment
    // =========================================================================

    @Nested
    @DisplayName("calculateOccupancyAdjustment")
    class CalculateOccupancyAdjustmentTests {

        @Test
        @DisplayName("within base occupancy returns zero")
        void calculateOccupancyAdjustment_withinBase_returnsZero() {
            // Arrange: base = 2, guests = 2
            OccupancyPricing pricing = occupancyPricing(2, new BigDecimal("25.00"), 6);

            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(pricing));

            // Act
            BigDecimal result = advancedRateManager.calculateOccupancyAdjustment(PROPERTY_ID, 2, ORG_ID);

            // Assert
            assertThat(result).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("extra guests returns fee")
        void calculateOccupancyAdjustment_extraGuests_returnsFee() {
            // Arrange: base = 2, guests = 4, extra = 2, fee = 25/guest => 50
            OccupancyPricing pricing = occupancyPricing(2, new BigDecimal("25.00"), 6);

            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(pricing));

            // Act
            BigDecimal result = advancedRateManager.calculateOccupancyAdjustment(PROPERTY_ID, 4, ORG_ID);

            // Assert: (4 - 2) * 25 = 50
            assertThat(result).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("no config returns zero")
        void calculateOccupancyAdjustment_noConfig_returnsZero() {
            // Arrange
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act
            BigDecimal result = advancedRateManager.calculateOccupancyAdjustment(PROPERTY_ID, 5, ORG_ID);

            // Assert
            assertThat(result).isEqualByComparingTo("0");
        }
    }

    // =========================================================================
    // applyYieldRules
    // =========================================================================

    @Nested
    @DisplayName("applyYieldRules")
    class ApplyYieldRulesTests {

        @Test
        @DisplayName("with DAYS_BEFORE_ARRIVAL rule adjusts price and creates override")
        void applyYieldRules_occupancyThreshold_adjustsPrice() throws Exception {
            // Arrange: a DAYS_BEFORE_ARRIVAL rule with +15% adjustment
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("Early Bird +15%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("15"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new ObjectMapper().readTree("{\"daysAhead\": 30}"));

            // Target date = today + 30 days
            // Le yield calcule depuis le prix de base HORS overrides YIELD_RULE (Z5-BUGS-02)
            LocalDate targetDate = LocalDate.now().plusDays(30);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(targetDate), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, targetDate, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert: override and audit log created
            verify(rateOverrideRepository).save(any(RateOverride.class));
            verify(rateAuditLogRepository).save(any(RateAuditLog.class));
        }

        @Test
        @DisplayName("no active rules does nothing")
        void applyYieldRules_noActiveRules_noChanges() {
            // Arrange
            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert: no property lookup, no override created
            verify(propertyRepository, never()).findById(anyLong());
            verify(rateOverrideRepository, never()).save(any());
            verify(rateAuditLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("property not found skips evaluation")
        void applyYieldRules_propertyNotFound_skips() {
            YieldRule rule = new YieldRule();
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("10"));
            rule.setActive(true);

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            verify(rateOverrideRepository, never()).save(any());
        }

        @Test
        @DisplayName("OCCUPANCY_THRESHOLD rule is logged but skipped")
        void applyYieldRules_occupancyThreshold_isSkipped() throws Exception {
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("OccupancyThresh");
            rule.setRuleType(YieldRule.RuleType.OCCUPANCY_THRESHOLD);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("10"));
            rule.setActive(true);
            rule.setTriggerCondition("{}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{}"));

            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            verify(rateOverrideRepository, never()).save(any(RateOverride.class));
        }

        @Test
        @DisplayName("LAST_MINUTE_FILL with -20% adjustment creates override")
        void applyYieldRules_lastMinuteFill_appliesNegativeAdjustment() throws Exception {
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("Last Minute -20%");
            rule.setRuleType(YieldRule.RuleType.LAST_MINUTE_FILL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("-20"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"withinDays\": 2}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"withinDays\": 2}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"withinDays\": 2}"));

            when(priceEngine.resolvePrice(eq(PROPERTY_ID), any(LocalDate.class), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100"));
            when(rateOverrideRepository.findByPropertyIdAndDate(eq(PROPERTY_ID), any(LocalDate.class), eq(ORG_ID)))
                    .thenReturn(Optional.empty());

            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // 2 days within the window
            verify(rateOverrideRepository, atLeast(1)).save(any(RateOverride.class));
            verify(rateAuditLogRepository, atLeast(1)).save(any(RateAuditLog.class));
        }

        @Test
        @DisplayName("DAYS_BEFORE_ARRIVAL with existing YIELD_RULE override updates it from base price")
        void applyYieldRules_existingOverride_isUpdated() throws Exception {
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("Early Bird +15%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("15"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate target = LocalDate.now().plusDays(30);
            // Prix de base hors overrides YIELD_RULE = 100 (Z5-BUGS-02)
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(target), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100"));

            // Existing YIELD_RULE override (run precedent) — should be updated, not created
            RateOverride existing = new RateOverride();
            existing.setNightlyPrice(new BigDecimal("80"));
            existing.setSource("YIELD_RULE");
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, target, ORG_ID))
                    .thenReturn(Optional.of(existing));

            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            verify(rateOverrideRepository).save(existing);
            assertThat(existing.getSource()).isEqualTo("YIELD_RULE");
            // Recalcule depuis le prix de base (100 +15% = 115), pas depuis l'override (80)
            assertThat(existing.getNightlyPrice()).isEqualByComparingTo("115.00");
        }

        @Test
        @DisplayName("running the same rule twice does not compound the adjustment (Z5-BUGS-02)")
        void whenYieldRuleRunsTwice_thenPriceDoesNotCompound() throws Exception {
            // Arrange : regle -10% sur un prix de base de 100
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("LastMinute -10%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("-10"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate target = LocalDate.now().plusDays(30);
            // Le prix de base HORS overrides YIELD_RULE reste 100 d'un run a l'autre
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(target), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));

            // Run 1 : pas d'override → creation a 90 ; Run 2 : l'override yield de 90 existe
            RateOverride yieldOverride = new RateOverride();
            yieldOverride.setNightlyPrice(new BigDecimal("90.00"));
            yieldOverride.setSource("YIELD_RULE");
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, target, ORG_ID))
                    .thenReturn(Optional.empty())
                    .thenReturn(Optional.of(yieldOverride));

            // Act : deux runs successifs
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert : une seule ecriture (le run 2 recalcule 90 == valeur courante → no-op),
            // et le prix cree au run 1 est bien -10% du prix de base
            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository, times(1)).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("90.00");
        }

        @Test
        @DisplayName("EXTERNAL_PRICING override is never overwritten by yield (Z5-BUGS-02)")
        void whenOverrideIsExternalPricing_thenYieldDoesNotTouchIt() throws Exception {
            // Arrange
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("LastMinute -10%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("-10"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate target = LocalDate.now().plusDays(30);
            RateOverride external = new RateOverride();
            external.setNightlyPrice(new BigDecimal("140.00"));
            external.setSource("EXTERNAL_PRICING");
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, target, ORG_ID))
                    .thenReturn(Optional.of(external));

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert : aucune ecriture, le prix PriceLabs reste intact
            verify(rateOverrideRepository, never()).save(any());
            assertThat(external.getNightlyPrice()).isEqualByComparingTo("140.00");
            assertThat(external.getSource()).isEqualTo("EXTERNAL_PRICING");
        }

        @Test
        @DisplayName("without minPrice/maxPrice the ±50% default clamp applies (Z5-BUGS-02)")
        void whenNoMinMaxConfigured_thenDefaultClampBoundsApply() throws Exception {
            // Arrange : regle -80% sans bornes → garde-fou plancher a 50% du prix de base
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("Crash -80%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("-80"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");
            // minPrice / maxPrice volontairement absents (champs nullables)

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate target = LocalDate.now().plusDays(30);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(target), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, target, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert : 100 -80% = 20, borne au plancher par defaut 50.00 (±50%)
            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("'today' is resolved in the property timezone, not the JVM one (Z5-BUGS-08)")
        void whenPropertyHasTimezone_thenTodayResolvedInPropertyZone() throws Exception {
            // Arrange : propriete a Kiritimati (UTC+14) — la date locale peut
            // differer de celle du serveur ; la cible doit suivre la propriete.
            Property property = new Property();
            property.setId(PROPERTY_ID);
            property.setTimezone("Pacific/Kiritimati");

            YieldRule rule = new YieldRule();
            rule.setName("Early Bird +15%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("15"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new ObjectMapper().readTree("{\"daysAhead\": 30}"));

            java.time.ZoneId propertyZone = java.time.ZoneId.of("Pacific/Kiritimati");
            LocalDate expectedTarget = LocalDate.now(propertyZone).plusDays(30);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(expectedTarget), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, expectedTarget, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert : l'override est cree sur la date calculee dans la TZ propriete
            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getDate()).isEqualTo(expectedTarget);
        }

        @Test
        @DisplayName("invalid property timezone falls back to Europe/Paris (Z5-BUGS-08)")
        void whenPropertyTimezoneInvalid_thenFallsBackToEuropeParis() throws Exception {
            Property property = new Property();
            property.setId(PROPERTY_ID);
            property.setTimezone("Mars/Olympus");

            YieldRule rule = new YieldRule();
            rule.setName("Early Bird +15%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("15"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate expectedTarget = LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(30);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(expectedTarget), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, expectedTarget, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act : ne doit pas lever malgre la timezone invalide
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert
            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getDate()).isEqualTo(expectedTarget);
        }

        @Test
        @DisplayName("yield rule with invalid JSON is caught silently")
        void applyYieldRules_invalidJson_isCaught() throws Exception {
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("BadRule");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("10"));
            rule.setActive(true);
            rule.setTriggerCondition("{invalid");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{invalid"))
                    .thenThrow(new com.fasterxml.jackson.core.JsonParseException(null, "bad json"));

            // Should not throw
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            verify(rateOverrideRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("resolveChannelPrice with null base")
    class ResolveChannelPriceNullBase {

        @Test
        @DisplayName("returns null when base price is null")
        void resolveChannelPrice_nullBase_returnsNull() {
            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(null);

            BigDecimal result = advancedRateManager.resolveChannelPrice(
                    PROPERTY_ID, DATE, ChannelName.BOOKING, ORG_ID);

            assertThat(result).isNull();
        }

        @Test
        @DisplayName("with nights+guests, null base returns null")
        void resolveChannelPriceWithNightsGuests_nullBase_returnsNull() {
            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(null);

            BigDecimal result = advancedRateManager.resolveChannelPrice(
                    PROPERTY_ID, DATE, ChannelName.BOOKING, 3, 2, ORG_ID);

            assertThat(result).isNull();
        }

        @Test
        @DisplayName("with nights+guests, adds occupancy adjustment")
        void resolveChannelPriceWithNightsGuests_addsOccupancy() {
            when(priceEngine.resolvePrice(PROPERTY_ID, DATE, ORG_ID)).thenReturn(BASE_PRICE);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of());
            OccupancyPricing pricing = occupancyPricing(2, new BigDecimal("20.00"), 6);
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(pricing));

            BigDecimal result = advancedRateManager.resolveChannelPrice(
                    PROPERTY_ID, DATE, ChannelName.BOOKING, 3, 4, ORG_ID);

            // 100 + (4-2)*20 = 140
            assertThat(result).isEqualByComparingTo("140.00");
        }
    }

    @Nested
    @DisplayName("resolveChannelPriceRange edge cases")
    class ResolveChannelPriceRangeEdge {

        @Test
        @DisplayName("null base price keeps null in result map")
        void rangeWithNullBase_keepsNullInResult() {
            LocalDate from = DATE;
            LocalDate to = DATE.plusDays(2);
            Map<LocalDate, BigDecimal> basePrices = new LinkedHashMap<>();
            basePrices.put(DATE, null);
            basePrices.put(DATE.plusDays(1), new BigDecimal("80.00"));

            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(basePrices);
            when(channelRateModifierRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(List.of());

            Map<LocalDate, BigDecimal> result = advancedRateManager.resolveChannelPriceRange(
                    PROPERTY_ID, from, to, ChannelName.BOOKING, ORG_ID);

            assertThat(result.get(DATE)).isNull();
            assertThat(result.get(DATE.plusDays(1))).isEqualByComparingTo("80.00");
        }
    }

    @Nested
    @DisplayName("calculateLosDiscount edge cases")
    class CalculateLosDiscountEdge {

        @Test
        @DisplayName("null total returns ZERO")
        void nullTotal_returnsZero() {
            BigDecimal result = advancedRateManager.calculateLosDiscount(PROPERTY_ID, 7, null, ORG_ID);
            assertThat(result).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("zero nights returns ZERO")
        void zeroNights_returnsZero() {
            BigDecimal result = advancedRateManager.calculateLosDiscount(
                    PROPERTY_ID, 0, new BigDecimal("500"), ORG_ID);
            assertThat(result).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("negative nights returns ZERO")
        void negativeNights_returnsZero() {
            BigDecimal result = advancedRateManager.calculateLosDiscount(
                    PROPERTY_ID, -1, new BigDecimal("500"), ORG_ID);
            assertThat(result).isEqualByComparingTo("0");
        }
    }

    @Nested
    @DisplayName("calculateOccupancyAdjustment edge cases")
    class CalculateOccupancyAdjustmentEdge {

        @Test
        @DisplayName("zero guests returns ZERO immediately")
        void zeroGuests_returnsZero() {
            BigDecimal result = advancedRateManager.calculateOccupancyAdjustment(PROPERTY_ID, 0, ORG_ID);
            assertThat(result).isEqualByComparingTo("0");
            verify(occupancyPricingRepository, never()).findByPropertyId(any(), any());
        }

        @Test
        @DisplayName("negative guests returns ZERO")
        void negativeGuests_returnsZero() {
            BigDecimal result = advancedRateManager.calculateOccupancyAdjustment(PROPERTY_ID, -1, ORG_ID);
            assertThat(result).isEqualByComparingTo("0");
        }
    }

    // =========================================================================
    // getRateCalendar — yield rule affichee par date (Z5-BUGS-09)
    // =========================================================================

    @Nested
    @DisplayName("getRateCalendar — applied yield rule filtered by date (Z5-BUGS-09)")
    class GetRateCalendarYieldDisplayTests {

        private final LocalDate today = LocalDate.now(java.time.ZoneId.of("Europe/Paris"));

        private Property propertyWithoutTimezone() {
            Property property = new Property();
            property.setId(PROPERTY_ID);
            return property; // timezone absente → fallback Europe/Paris
        }

        private YieldRule rule(String name, YieldRule.RuleType type, String triggerCondition) {
            YieldRule rule = new YieldRule();
            rule.setName(name);
            rule.setRuleType(type);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("10"));
            rule.setActive(true);
            rule.setTriggerCondition(triggerCondition);
            return rule;
        }

        private void stubCalendarCollaborators(LocalDate from, LocalDate to, List<YieldRule> rules)
                throws Exception {
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(new LinkedHashMap<>());
            when(channelRateModifierRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());
            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(rules);
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(propertyWithoutTimezone()));
            for (YieldRule rule : rules) {
                when(objectMapper.readTree(rule.getTriggerCondition()))
                        .thenReturn(new ObjectMapper().readTree(rule.getTriggerCondition()));
            }
        }

        @Test
        @DisplayName("DAYS_BEFORE_ARRIVAL rule is displayed only on today+daysAhead")
        void getRateCalendar_daysBeforeArrival_displayedOnlyOnTargetDate() throws Exception {
            // Arrange : regle ciblant J+30, calendrier sur 35 jours
            YieldRule rule = rule("Early Bird +10%", YieldRule.RuleType.DAYS_BEFORE_ARRIVAL,
                    "{\"daysAhead\": 30}");
            LocalDate from = today;
            LocalDate to = today.plusDays(35);
            stubCalendarCollaborators(from, to, List.of(rule));

            // Act
            List<RateCalendarDto> calendar = advancedRateManager.getRateCalendar(
                    PROPERTY_ID, from, to, ORG_ID);

            // Assert : la regle n'apparait QUE sur la date ciblee, plus sur tous les jours
            assertThat(calendar).hasSize(35);
            LocalDate target = today.plusDays(30);
            assertThat(calendar).filteredOn(day -> day.date().equals(target))
                    .singleElement()
                    .satisfies(day -> assertThat(day.appliedYieldRule()).isEqualTo("Early Bird +10%"));
            assertThat(calendar).filteredOn(day -> !day.date().equals(target))
                    .allSatisfy(day -> assertThat(day.appliedYieldRule()).isNull());
        }

        @Test
        @DisplayName("LAST_MINUTE_FILL rule is displayed only within [today, today+withinDays)")
        void getRateCalendar_lastMinuteFill_displayedOnlyInWindow() throws Exception {
            // Arrange : fenetre de 2 jours, calendrier sur 5 jours
            YieldRule rule = rule("Last Minute -10%", YieldRule.RuleType.LAST_MINUTE_FILL,
                    "{\"withinDays\": 2}");
            LocalDate from = today;
            LocalDate to = today.plusDays(5);
            stubCalendarCollaborators(from, to, List.of(rule));

            // Act
            List<RateCalendarDto> calendar = advancedRateManager.getRateCalendar(
                    PROPERTY_ID, from, to, ORG_ID);

            // Assert
            assertThat(calendar).hasSize(5);
            assertThat(calendar.get(0).appliedYieldRule()).isEqualTo("Last Minute -10%");
            assertThat(calendar.get(1).appliedYieldRule()).isEqualTo("Last Minute -10%");
            assertThat(calendar.get(2).appliedYieldRule()).isNull();
            assertThat(calendar.get(3).appliedYieldRule()).isNull();
            assertThat(calendar.get(4).appliedYieldRule()).isNull();
        }

        @Test
        @DisplayName("OCCUPANCY_THRESHOLD rule (not evaluated by the engine) is never displayed")
        void getRateCalendar_occupancyThreshold_neverDisplayed() throws Exception {
            // Arrange : type non evalue par applyYieldRules → jamais « applique »
            YieldRule rule = rule("Occupancy 80%", YieldRule.RuleType.OCCUPANCY_THRESHOLD, "{}");
            LocalDate from = today;
            LocalDate to = today.plusDays(3);
            stubCalendarCollaborators(from, to, List.of(rule));

            // Act
            List<RateCalendarDto> calendar = advancedRateManager.getRateCalendar(
                    PROPERTY_ID, from, to, ORG_ID);

            // Assert
            assertThat(calendar)
                    .allSatisfy(day -> assertThat(day.appliedYieldRule()).isNull());
        }
    }

    // =========================================================================
    // Comparaison de prix yield insensible a l'echelle BigDecimal (Z5-BUGS-10)
    // =========================================================================

    @Nested
    @DisplayName("yield override comparison ignores BigDecimal scale (Z5-BUGS-10)")
    class YieldPriceScaleComparisonTests {

        @Test
        @DisplayName("override at '90' (scale 0) vs computed 90.00 -> no parasite write")
        void whenPricesEqualWithDifferentScale_thenNoOverrideNorAuditWritten() throws Exception {
            // Arrange : regle -10% sur base 100.00 → 90.00 (echelle 2) ;
            // l'override existant stocke 90 (echelle 0). equals() les verrait
            // differents, compareTo() non — aucun override/audit parasite attendu.
            Property property = new Property();
            property.setId(PROPERTY_ID);

            YieldRule rule = new YieldRule();
            rule.setName("LastMinute -10%");
            rule.setRuleType(YieldRule.RuleType.DAYS_BEFORE_ARRIVAL);
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(new BigDecimal("-10"));
            rule.setActive(true);
            rule.setTriggerCondition("{\"daysAhead\": 30}");

            when(yieldRuleRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(property));
            when(objectMapper.readTree("{\"daysAhead\": 30}"))
                    .thenReturn(new ObjectMapper().readTree("{\"daysAhead\": 30}"));

            LocalDate target = LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(30);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(target), eq(ORG_ID), anySet()))
                    .thenReturn(new BigDecimal("100.00"));

            RateOverride existing = new RateOverride();
            existing.setNightlyPrice(new BigDecimal("90"));
            existing.setSource("YIELD_RULE");
            when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, target, ORG_ID))
                    .thenReturn(Optional.of(existing));

            // Act
            advancedRateManager.applyYieldRules(PROPERTY_ID, ORG_ID);

            // Assert
            verify(rateOverrideRepository, never()).save(any());
            verify(rateAuditLogRepository, never()).save(any());
        }
    }
}
