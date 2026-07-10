package com.clenzy.service.pricing;

import com.clenzy.model.Property;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du Moteur Ménage (Phase 1A).
 * Config par défaut sauf mention contraire (getCleaningEngineConfigJson → null).
 */
@ExtendWith(MockitoExtension.class)
class CleaningPricingEngineTest {

    @Mock private PricingConfigService pricingConfigService;

    private CleaningPricingEngine engine() {
        return new CleaningPricingEngine(pricingConfigService, new ObjectMapper());
    }

    private void withDefaults() {
        when(pricingConfigService.getCleaningEngineConfigJson()).thenReturn(null);
    }

    /** Profil de calibration « Duplex Marrakech » : 2 ch, 1 SDB, 50 m², 2 niveaux. */
    private static CleaningInputs marrakech() {
        return new CleaningInputs(2, 1, 50, 2, false, false, 4);
    }

    @Nested
    @DisplayName("quote — cas nominal (défauts)")
    class NominalQuote {

        @Test
        void whenMarrakechProfile_thenCleaningRecommendedIs95() {
            withDefaults();
            // minutes = base(2ch)=120 + étage sup. 15 = 135 ; 135/60 × 42 €/h = 94,50 → arrondi 5 → 95.
            CleaningQuote quote = engine().quote(marrakech(), "CLEANING");

            assertThat(quote.durationMinutes()).isEqualTo(135);
            assertThat(quote.recommended()).isEqualByComparingTo("95");
            // Fourchette ±15 % ancrée sur la médiane : 80,75 → 80 ; 109,25 → 110.
            assertThat(quote.min()).isEqualByComparingTo("80");
            assertThat(quote.max()).isEqualByComparingTo("110");
        }

        @Test
        void whenAllComponentsPresent_thenMinutesSumMatchesBreakdown() {
            withDefaults();
            // 3 ch (150) + 1 SDB sup. (15) + 100 m² (20/5=4 pas → 4 min) + 2 étages (15)
            // + extérieur (20) + buanderie (15) + 6 guests (2×5=10) = 229 min.
            CleaningInputs inputs = new CleaningInputs(3, 2, 100, 2, true, true, 6);

            Map<String, Integer> parts = engine().minutesBreakdown(inputs);
            assertThat(parts).containsEntry("base", 150)
                    .containsEntry("bathrooms", 15)
                    .containsEntry("surface", 4)
                    .containsEntry("floors", 15)
                    .containsEntry("exterior", 20)
                    .containsEntry("laundry", 15)
                    .containsEntry("guests", 10);

            CleaningQuote quote = engine().quote(inputs, "CLEANING");
            assertThat(quote.durationMinutes()).isEqualTo(229);
        }

        @Test
        void whenInputsAllNull_thenFallsBackToZeroBedroomBaseWithoutCrash() {
            withDefaults();
            CleaningQuote quote = engine().quote(
                    new CleaningInputs(null, null, null, null, null, null, null), "CLEANING");
            // base "0" = 90 min → 63 € → arrondi 65.
            assertThat(quote.durationMinutes()).isEqualTo(90);
            assertThat(quote.recommended()).isEqualByComparingTo("65");
        }
    }

    @Nested
    @DisplayName("quote — multiplicateurs type de ménage")
    class TypeMultipliers {

        @Test
        void whenExpressCleaning_thenPriceIsScaledDown() {
            withDefaults();
            // 135 min × 42 × 0.65 = 61,42 → arrondi 60. Durée normée inchangée.
            CleaningQuote quote = engine().quote(marrakech(), "EXPRESS_CLEANING");
            assertThat(quote.durationMinutes()).isEqualTo(135);
            assertThat(quote.recommended()).isEqualByComparingTo("60");
        }

        @Test
        void whenDeepCleaning_thenPriceIsScaledUp() {
            withDefaults();
            // 135 min × 42 × 1.6 = 151,20 → arrondi 150.
            CleaningQuote quote = engine().quote(marrakech(), "DEEP_CLEANING");
            assertThat(quote.recommended()).isEqualByComparingTo("150");
        }

        @Test
        void whenUnknownType_thenFallsBackToStandardMultiplier() {
            withDefaults();
            CleaningQuote unknown = engine().quote(marrakech(), "UNKNOWN_TYPE");
            CleaningQuote standard = engine().quote(marrakech(), "CLEANING");
            assertThat(unknown.recommended()).isEqualByComparingTo(standard.recommended());
        }
    }

    @Nested
    @DisplayName("quote — plancher, arrondi, fourchette")
    class FloorRoundingRange {

        @Test
        void whenTinyProperty_thenMinPriceFloorApplies() {
            withDefaults();
            // Studio 0 ch express : 90 min × 42 × 0.65 = 40,95 → 40 (> plancher 30, pas de plancher).
            // Pour forcer le plancher : config custom taux très bas.
            when(pricingConfigService.getCleaningEngineConfigJson())
                    .thenReturn("{\"hourlyRate\": 5.0}");
            CleaningQuote quote = engine().quote(new CleaningInputs(0, 1, 20, 1, false, false, 2), "CLEANING");
            // 90 min × 5 €/h = 7,50 → plancher 30 → arrondi 30.
            assertThat(quote.recommended()).isEqualByComparingTo("30");
            assertThat(quote.min()).isEqualByComparingTo("30");
        }

        @Test
        void whenAnyProfile_thenPricesAreMultiplesOfRoundTo() {
            withDefaults();
            CleaningQuote quote = engine().quote(new CleaningInputs(3, 2, 95, 1, true, false, 5), "CLEANING");
            assertThat(quote.recommended().remainder(BigDecimal.valueOf(5))).isEqualByComparingTo("0");
            assertThat(quote.min().remainder(BigDecimal.valueOf(5))).isEqualByComparingTo("0");
            assertThat(quote.max().remainder(BigDecimal.valueOf(5))).isEqualByComparingTo("0");
        }

        @Test
        void whenQuoted_thenRangeSurroundsRecommended() {
            withDefaults();
            CleaningQuote quote = engine().quote(marrakech(), "CLEANING");
            assertThat(quote.min()).isLessThanOrEqualTo(quote.recommended());
            assertThat(quote.max()).isGreaterThanOrEqualTo(quote.recommended());
        }
    }

    @Nested
    @DisplayName("config custom (JSON org) vs défauts")
    class CustomConfig {

        @Test
        void whenCustomHourlyRateAndMinutes_thenTheyOverrideDefaults() {
            when(pricingConfigService.getCleaningEngineConfigJson()).thenReturn("""
                    {"hourlyRate": 60.0,
                     "componentMinutes": {"baseByBedrooms": {"2": 60}, "perExtraFloor": 30},
                     "rangePercent": 10, "roundTo": 1, "minPrice": 10}
                    """);
            // minutes = 60 + 30 = 90 ; 1,5 h × 60 = 90 € (roundTo 1).
            CleaningQuote quote = engine().quote(marrakech(), "CLEANING");
            assertThat(quote.durationMinutes()).isEqualTo(90);
            assertThat(quote.recommended()).isEqualByComparingTo("90");
            assertThat(quote.min()).isEqualByComparingTo("81");
            assertThat(quote.max()).isEqualByComparingTo("99");
        }

        @Test
        void whenConfigJsonInvalid_thenFallsBackToDefaults() {
            when(pricingConfigService.getCleaningEngineConfigJson()).thenReturn("{not json");
            CleaningQuote quote = engine().quote(marrakech(), "CLEANING");
            assertThat(quote.recommended()).isEqualByComparingTo("95");
        }
    }

    @Nested
    @DisplayName("resolveCleaningPrice — override logement vs moteur")
    class Resolver {

        private Property property(BigDecimal cleaningBasePrice) {
            Property p = new Property();
            p.setBedroomCount(2);
            p.setBathroomCount(1);
            p.setSquareMeters(50);
            p.setNumberOfFloors(2);
            p.setHasExterior(false);
            p.setHasLaundry(false);
            p.setMaxGuests(4);
            p.setCleaningBasePrice(cleaningBasePrice);
            return p;
        }

        @Test
        void whenCleaningBasePriceSet_thenPropertyOverrideWins() {
            withDefaults();
            ResolvedCleaningPrice resolved =
                    engine().resolveCleaningPrice(property(BigDecimal.valueOf(120)), "CLEANING");
            assertThat(resolved.amount()).isEqualByComparingTo("120");
            assertThat(resolved.source()).isEqualTo(CleaningPriceSource.PROPERTY_OVERRIDE);
            // Le conseil (quote) reste calculé pour le snapshot recommended_cost.
            assertThat(resolved.quote().recommended()).isEqualByComparingTo("95");
        }

        @Test
        void whenNoBasePrice_thenEngineRecommendedIsUsed() {
            withDefaults();
            ResolvedCleaningPrice resolved = engine().resolveCleaningPrice(property(null), "CLEANING");
            assertThat(resolved.amount()).isEqualByComparingTo("95");
            assertThat(resolved.source()).isEqualTo(CleaningPriceSource.ENGINE);
        }

        @Test
        void whenBasePriceIsZero_thenTreatedAsUnsetAndEngineWins() {
            withDefaults();
            ResolvedCleaningPrice resolved =
                    engine().resolveCleaningPrice(property(BigDecimal.ZERO), "CLEANING");
            assertThat(resolved.source()).isEqualTo(CleaningPriceSource.ENGINE);
            assertThat(resolved.amount()).isEqualByComparingTo("95");
        }
    }
}
