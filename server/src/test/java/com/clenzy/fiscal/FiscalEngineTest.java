package com.clenzy.fiscal;

import com.clenzy.model.TaxRule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FiscalEngineTest {

    @Mock
    private TaxCalculatorRegistry registry;

    @Mock
    private TaxCalculator calculator;

    private FiscalEngine fiscalEngine;

    @BeforeEach
    void setUp() {
        fiscalEngine = new FiscalEngine(registry);
    }

    @Nested
    class CalculateTax {
        @Test
        void shouldDelegateToCorrectCalculator() {
            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "ACCOMMODATION", "Test");
            LocalDate date = LocalDate.of(2026, 1, 15);
            TaxResult expected = new TaxResult(
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("110.00"),
                new BigDecimal("0.10"), "TVA 10%", "ACCOMMODATION"
            );

            when(registry.get("FR")).thenReturn(calculator);
            when(calculator.calculateTax(item, date)).thenReturn(expected);

            TaxResult result = fiscalEngine.calculateTax("FR", item, date);

            assertThat(result).isEqualTo(expected);
            verify(registry).get("FR");
            verify(calculator).calculateTax(item, date);
        }

        @Test
        void shouldThrowForUnsupportedCountry() {
            when(registry.get("XX")).thenThrow(new UnsupportedCountryException("XX"));

            TaxableItem item = new TaxableItem(new BigDecimal("100.00"), "STANDARD", "Test");
            assertThatThrownBy(() -> fiscalEngine.calculateTax("XX", item, LocalDate.now()))
                .isInstanceOf(UnsupportedCountryException.class);
        }
    }

    @Nested
    class CalculateTouristTax {
        @Test
        void shouldDelegateToCorrectCalculator() {
            TouristTaxInput input = TouristTaxInput.perPerson(
                BigDecimal.ZERO, 2, 3, 0, new BigDecimal("1.50"));
            TouristTaxResult expected = new TouristTaxResult(
                new BigDecimal("9.00"), "Taxe de sejour", new BigDecimal("1.50"));

            when(registry.get("FR")).thenReturn(calculator);
            when(calculator.calculateTouristTax(input)).thenReturn(expected);

            TouristTaxResult result = fiscalEngine.calculateTouristTax("FR", input);

            assertThat(result).isEqualTo(expected);
        }
    }

    @Nested
    class IsCountrySupported {
        @Test
        void shouldDelegateToRegistry() {
            when(registry.isSupported("FR")).thenReturn(true);
            when(registry.isSupported("XX")).thenReturn(false);

            assertThat(fiscalEngine.isCountrySupported("FR")).isTrue();
            assertThat(fiscalEngine.isCountrySupported("XX")).isFalse();
        }
    }
}
