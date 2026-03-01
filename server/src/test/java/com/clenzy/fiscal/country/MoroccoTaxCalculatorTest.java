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
class MoroccoTaxCalculatorTest {

    @Mock
    private TaxRuleRepository taxRuleRepository;

    private MoroccoTaxCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new MoroccoTaxCalculator(taxRuleRepository);
    }

    @Test
    void shouldReturnMACountryCode() {
        assertThat(calculator.getCountryCode()).isEqualTo("MA");
    }

    @Nested
    class CalculateTax {

        private final LocalDate date = LocalDate.of(2026, 1, 15);

        @Test
        void shouldCalculateAccommodationTaxAt10Percent() {
            TaxRule rule = new TaxRule("MA", "ACCOMMODATION", new BigDecimal("0.1000"),
                "TVA hebergement 10%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("MA", "ACCOMMODATION", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("500.00"), "ACCOMMODATION", "Hebergement");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.amountHT()).isEqualByComparingTo("500.00");
            assertThat(result.taxAmount()).isEqualByComparingTo("50.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("550.00");
            assertThat(result.taxRate()).isEqualByComparingTo("0.1000");
        }

        @Test
        void shouldCalculateStandardTaxAt20Percent() {
            TaxRule rule = new TaxRule("MA", "STANDARD", new BigDecimal("0.2000"),
                "TVA standard 20%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("MA", "STANDARD", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "STANDARD", "Service");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.taxAmount()).isEqualByComparingTo("20.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("120.00");
        }

        @Test
        void shouldCalculateFoodTaxAt7Percent() {
            TaxRule rule = new TaxRule("MA", "FOOD", new BigDecimal("0.0700"),
                "TVA alimentation 7%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("MA", "FOOD", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "FOOD", "Alimentation");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.taxAmount()).isEqualByComparingTo("7.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("107.00");
        }

        @Test
        void shouldThrowWhenNoRuleFound() {
            when(taxRuleRepository.findApplicableRule("MA", "UNKNOWN", date))
                .thenReturn(Optional.empty());

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "UNKNOWN", "Test");
            assertThatThrownBy(() -> calculator.calculateTax(item, date))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No tax rule found for MA/UNKNOWN");
        }
    }

    @Nested
    class CalculateTouristTax {

        @Test
        void shouldCalculatePerPersonPerNightInMAD() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 5, 0, new BigDecimal("15.00"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 2 personnes x 5 nuits x 15.00 MAD = 150.00 MAD
            assertThat(result.amount()).isEqualByComparingTo("150.00");
            assertThat(result.perPersonPerNight()).isEqualByComparingTo("15.00");
            assertThat(result.description()).contains("MAD");
        }

        @Test
        void shouldReturnZeroForNullRate() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 3, 0, null);

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("0");
        }

        @Test
        void shouldReturnZeroForZeroRate() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 3, 0, BigDecimal.ZERO);

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("0");
        }
    }
}
