package com.clenzy.fiscal.country;

import com.clenzy.fiscal.*;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SaudiTaxCalculatorTest {

    @Mock
    private TaxRuleRepository taxRuleRepository;

    private SaudiTaxCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new SaudiTaxCalculator(taxRuleRepository);
    }

    @Test
    void shouldReturnSACountryCode() {
        assertThat(calculator.getCountryCode()).isEqualTo("SA");
    }

    @Nested
    class CalculateTax {

        private final LocalDate date = LocalDate.of(2026, 1, 15);

        @Test
        void shouldCalculateUniformVatAt15Percent() {
            TaxRule rule = new TaxRule("SA", "ACCOMMODATION", new BigDecimal("0.1500"),
                "VAT 15%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("SA", "ACCOMMODATION", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("1000.00"), "ACCOMMODATION", "Hebergement");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.amountHT()).isEqualByComparingTo("1000.00");
            assertThat(result.taxAmount()).isEqualByComparingTo("150.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("1150.00");
            assertThat(result.taxRate()).isEqualByComparingTo("0.1500");
        }

        @Test
        void shouldCalculateStandardVatAt15Percent() {
            TaxRule rule = new TaxRule("SA", "STANDARD", new BigDecimal("0.1500"),
                "VAT 15%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("SA", "STANDARD", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("200.00"), "STANDARD", "Service");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.taxAmount()).isEqualByComparingTo("30.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("230.00");
        }

        @Test
        void shouldThrowWhenNoRuleFound() {
            when(taxRuleRepository.findApplicableRule("SA", "UNKNOWN", date))
                .thenReturn(Optional.empty());

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "UNKNOWN", "Test");
            assertThatThrownBy(() -> calculator.calculateTax(item, date))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No tax rule found for SA/UNKNOWN");
        }
    }

    @Nested
    class CalculateTouristTax {

        @Test
        void shouldCalculateMunicipalityFeeAt5Percent() {
            // Saudi : percentage of nightly rate, default 5%
            TouristTaxInput input = TouristTaxInput.percentage(
                new BigDecimal("500.00"), 2, 3, new BigDecimal("0.05"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 5% of 500 = 25.00 per night, x 3 nights = 75.00
            assertThat(result.amount()).isEqualByComparingTo("75.00");
            assertThat(result.perPersonPerNight()).isEqualByComparingTo("25.00");
            assertThat(result.description()).contains("Municipality fee");
            assertThat(result.description()).contains("SAR");
        }

        @Test
        void shouldUseDefault5PercentWhenRateIsNull() {
            // percentageRate=null → default 5%
            TouristTaxInput input = new TouristTaxInput(
                new BigDecimal("200.00"), 1, 2, 0, BigDecimal.ZERO, null);

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 5% of 200 = 10.00 per night, x 2 nights = 20.00
            assertThat(result.amount()).isEqualByComparingTo("20.00");
        }

        @Test
        void shouldUseDefault5PercentWhenRateIsZero() {
            TouristTaxInput input = TouristTaxInput.percentage(
                new BigDecimal("200.00"), 1, 2, BigDecimal.ZERO);

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 5% of 200 = 10.00 per night, x 2 nights = 20.00
            assertThat(result.amount()).isEqualByComparingTo("20.00");
        }

        @Test
        void shouldReturnZeroForNullNightlyRate() {
            TouristTaxInput input = TouristTaxInput.percentage(
                null, 2, 3, new BigDecimal("0.05"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("0");
        }

        @Test
        void shouldReturnZeroForZeroNightlyRate() {
            TouristTaxInput input = TouristTaxInput.percentage(
                BigDecimal.ZERO, 2, 3, new BigDecimal("0.05"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("0");
        }

        @Test
        void shouldHandleSingleNight() {
            TouristTaxInput input = TouristTaxInput.percentage(
                new BigDecimal("1000.00"), 1, 1, new BigDecimal("0.05"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 5% of 1000 = 50.00 per night, x 1 night = 50.00
            assertThat(result.amount()).isEqualByComparingTo("50.00");
        }
    }
}
