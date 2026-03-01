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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FranceTaxCalculatorTest {

    @Mock
    private TaxRuleRepository taxRuleRepository;

    private FranceTaxCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new FranceTaxCalculator(taxRuleRepository);
    }

    @Test
    void shouldReturnFRCountryCode() {
        assertThat(calculator.getCountryCode()).isEqualTo("FR");
    }

    @Nested
    class CalculateTax {

        private final LocalDate date = LocalDate.of(2026, 1, 15);

        @Test
        void shouldCalculateAccommodationTaxAt10Percent() {
            TaxRule rule = new TaxRule("FR", "ACCOMMODATION", new BigDecimal("0.1000"),
                "TVA hebergement 10%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("FR", "ACCOMMODATION", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("200.00"), "ACCOMMODATION", "Hebergement");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.amountHT()).isEqualByComparingTo("200.00");
            assertThat(result.taxAmount()).isEqualByComparingTo("20.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("220.00");
            assertThat(result.taxRate()).isEqualByComparingTo("0.1000");
            assertThat(result.taxName()).isEqualTo("TVA hebergement 10%");
            assertThat(result.taxCategory()).isEqualTo("ACCOMMODATION");
        }

        @Test
        void shouldCalculateStandardTaxAt20Percent() {
            TaxRule rule = new TaxRule("FR", "STANDARD", new BigDecimal("0.2000"),
                "TVA standard 20%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("FR", "STANDARD", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "STANDARD", "Service");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.amountHT()).isEqualByComparingTo("100.00");
            assertThat(result.taxAmount()).isEqualByComparingTo("20.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("120.00");
            assertThat(result.taxRate()).isEqualByComparingTo("0.2000");
        }

        @Test
        void shouldCalculateCleaningTaxAt20Percent() {
            TaxRule rule = new TaxRule("FR", "CLEANING", new BigDecimal("0.2000"),
                "TVA nettoyage 20%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("FR", "CLEANING", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("50.00"), "CLEANING", "Menage");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.taxAmount()).isEqualByComparingTo("10.00");
            assertThat(result.amountTTC()).isEqualByComparingTo("60.00");
        }

        @Test
        void shouldRoundTaxAmountCorrectly() {
            TaxRule rule = new TaxRule("FR", "ACCOMMODATION", new BigDecimal("0.1000"),
                "TVA 10%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRule("FR", "ACCOMMODATION", date))
                .thenReturn(Optional.of(rule));

            TaxableItem item = new TaxableItem(new BigDecimal("33.33"), "ACCOMMODATION", "Hebergement");
            TaxResult result = calculator.calculateTax(item, date);

            assertThat(result.taxAmount()).isEqualByComparingTo("3.33");
            assertThat(result.amountTTC()).isEqualByComparingTo("36.66");
        }

        @Test
        void shouldThrowWhenNoRuleFound() {
            when(taxRuleRepository.findApplicableRule("FR", "UNKNOWN", date))
                .thenReturn(Optional.empty());

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "UNKNOWN", "Test");
            assertThatThrownBy(() -> calculator.calculateTax(item, date))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No tax rule found for FR/UNKNOWN");
        }
    }

    @Nested
    class CalculateTouristTax {

        @Test
        void shouldCalculatePerPersonPerNight() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 3, 0, new BigDecimal("1.50"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            // 2 personnes x 3 nuits x 1.50 EUR = 9.00 EUR
            assertThat(result.amount()).isEqualByComparingTo("9.00");
            assertThat(result.perPersonPerNight()).isEqualByComparingTo("1.50");
            assertThat(result.description()).contains("2 pers");
            assertThat(result.description()).contains("3 nuits");
            assertThat(result.description()).contains("EUR");
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

        @Test
        void shouldReturnZeroForNegativeRate() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 3, 0, new BigDecimal("-1.00"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("0");
        }

        @Test
        void shouldHandleSingleGuestSingleNight() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 1, 1, 0, new BigDecimal("2.00"));

            TouristTaxResult result = calculator.calculateTouristTax(input);

            assertThat(result.amount()).isEqualByComparingTo("2.00");
        }
    }

    @Nested
    class GetApplicableRules {
        @Test
        void shouldDelegateToRepository() {
            LocalDate date = LocalDate.of(2026, 1, 15);
            TaxRule rule = new TaxRule("FR", "ACCOMMODATION", new BigDecimal("0.1000"),
                "TVA 10%", LocalDate.of(2020, 1, 1));

            when(taxRuleRepository.findApplicableRules("FR", "ACCOMMODATION", date))
                .thenReturn(List.of(rule));

            List<TaxRule> rules = calculator.getApplicableRules("ACCOMMODATION", date);

            assertThat(rules).hasSize(1);
            assertThat(rules.get(0).getTaxRate()).isEqualByComparingTo("0.1000");
        }
    }
}
