package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CurrencyConverterServiceTest {

    @Mock
    private ExchangeRateProviderService exchangeRateProvider;

    private CurrencyConverterService converterService;

    @BeforeEach
    void setUp() {
        converterService = new CurrencyConverterService(exchangeRateProvider);
    }

    @Nested
    class Convert {

        private final LocalDate date = LocalDate.of(2026, 1, 15);

        @Test
        void shouldConvertWithExchangeRate() {
            when(exchangeRateProvider.getRate("EUR", "MAD", date))
                .thenReturn(new BigDecimal("10.800000"));

            BigDecimal result = converterService.convert(
                new BigDecimal("100.00"), "EUR", "MAD", date);

            assertThat(result).isEqualByComparingTo("1080.00");
        }

        @Test
        void shouldReturnZeroForNullAmount() {
            BigDecimal result = converterService.convert(null, "EUR", "MAD", date);

            assertThat(result).isEqualByComparingTo("0");
            verifyNoInteractions(exchangeRateProvider);
        }

        @Test
        void shouldReturnZeroForZeroAmount() {
            BigDecimal result = converterService.convert(BigDecimal.ZERO, "EUR", "MAD", date);

            assertThat(result).isEqualByComparingTo("0");
            verifyNoInteractions(exchangeRateProvider);
        }

        @Test
        void shouldReturnRoundedAmountForSameCurrency() {
            BigDecimal result = converterService.convert(
                new BigDecimal("100.555"), "EUR", "EUR", date);

            assertThat(result).isEqualByComparingTo("100.56");
            verifyNoInteractions(exchangeRateProvider);
        }

        @Test
        void shouldBeCaseInsensitiveForSameCurrency() {
            BigDecimal result = converterService.convert(
                new BigDecimal("50.00"), "eur", "EUR", date);

            assertThat(result).isEqualByComparingTo("50.00");
            verifyNoInteractions(exchangeRateProvider);
        }

        @Test
        void shouldRoundConvertedAmount() {
            when(exchangeRateProvider.getRate("EUR", "SAR", date))
                .thenReturn(new BigDecimal("4.123456"));

            BigDecimal result = converterService.convert(
                new BigDecimal("33.33"), "EUR", "SAR", date);

            // 33.33 * 4.123456 = 137.434386... → 137.43
            assertThat(result).isEqualByComparingTo("137.43");
        }
    }

    @Nested
    class ConvertToBase {

        @Test
        void shouldDelegateToConvert() {
            LocalDate date = LocalDate.of(2026, 1, 15);
            when(exchangeRateProvider.getRate("MAD", "EUR", date))
                .thenReturn(new BigDecimal("0.092593"));

            BigDecimal result = converterService.convertToBase(
                new BigDecimal("1080.00"), "MAD", "EUR", date);

            assertThat(result).isEqualByComparingTo("100.00");
        }
    }

    @Nested
    class GetRate {

        @Test
        void shouldDelegateToProvider() {
            LocalDate date = LocalDate.of(2026, 1, 15);
            when(exchangeRateProvider.getRate("EUR", "MAD", date))
                .thenReturn(new BigDecimal("10.80"));

            BigDecimal rate = converterService.getRate("EUR", "MAD", date);

            assertThat(rate).isEqualByComparingTo("10.80");
            verify(exchangeRateProvider).getRate("EUR", "MAD", date);
        }
    }
}
