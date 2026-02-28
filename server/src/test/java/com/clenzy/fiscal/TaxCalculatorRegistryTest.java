package com.clenzy.fiscal;

import com.clenzy.model.TaxRule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TaxCalculatorRegistryTest {

    private TaxCalculatorRegistry registry;

    private final TaxCalculator frCalculator = new StubTaxCalculator("FR");
    private final TaxCalculator maCalculator = new StubTaxCalculator("MA");

    @BeforeEach
    void setUp() {
        registry = new TaxCalculatorRegistry(List.of(frCalculator, maCalculator));
    }

    @Nested
    class Get {
        @Test
        void shouldReturnCalculatorForSupportedCountry() {
            assertThat(registry.get("FR")).isSameAs(frCalculator);
            assertThat(registry.get("MA")).isSameAs(maCalculator);
        }

        @Test
        void shouldThrowForUnsupportedCountry() {
            assertThatThrownBy(() -> registry.get("XX"))
                .isInstanceOf(UnsupportedCountryException.class)
                .hasMessageContaining("XX");
        }
    }

    @Nested
    class IsSupported {
        @Test
        void shouldReturnTrueForRegisteredCountry() {
            assertThat(registry.isSupported("FR")).isTrue();
            assertThat(registry.isSupported("MA")).isTrue();
        }

        @Test
        void shouldReturnFalseForUnknownCountry() {
            assertThat(registry.isSupported("XX")).isFalse();
        }
    }

    @Nested
    class GetSupportedCountries {
        @Test
        void shouldReturnAllRegisteredCountries() {
            assertThat(registry.getSupportedCountries()).containsExactlyInAnyOrder("FR", "MA");
        }
    }

    // Stub implementation for testing
    private static class StubTaxCalculator implements TaxCalculator {
        private final String countryCode;

        StubTaxCalculator(String countryCode) {
            this.countryCode = countryCode;
        }

        @Override
        public String getCountryCode() { return countryCode; }

        @Override
        public TaxResult calculateTax(TaxableItem item, LocalDate date) {
            return new TaxResult(item.amount(), BigDecimal.ZERO, item.amount(),
                BigDecimal.ZERO, "stub", item.taxCategory());
        }

        @Override
        public TouristTaxResult calculateTouristTax(TouristTaxInput input) {
            return TouristTaxResult.zero();
        }

        @Override
        public List<TaxRule> getApplicableRules(String taxCategory, LocalDate date) {
            return List.of();
        }
    }
}
