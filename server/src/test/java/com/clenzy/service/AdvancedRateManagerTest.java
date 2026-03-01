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
            LocalDate targetDate = LocalDate.now().plusDays(30);
            when(priceEngine.resolvePrice(PROPERTY_ID, targetDate, ORG_ID))
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
    }
}
