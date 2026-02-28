package com.clenzy.service;

import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExchangeRateProviderServiceTest {

    @Mock
    private ExchangeRateRepository exchangeRateRepository;

    @Mock
    private RestTemplate restTemplate;

    private ExchangeRateProviderService providerService;

    @BeforeEach
    void setUp() {
        providerService = new ExchangeRateProviderService(exchangeRateRepository, restTemplate);
    }

    @Nested
    class GetRate {

        private final LocalDate date = LocalDate.of(2026, 1, 15);

        @Test
        void shouldReturnOneForSameCurrency() {
            BigDecimal rate = providerService.getRate("EUR", "EUR", date);

            assertThat(rate).isEqualByComparingTo("1");
            verifyNoInteractions(exchangeRateRepository);
        }

        @Test
        void shouldReturnOneForSameCurrencyCaseInsensitive() {
            BigDecimal rate = providerService.getRate("eur", "EUR", date);

            assertThat(rate).isEqualByComparingTo("1");
        }

        @Test
        void shouldReturnDirectRate() {
            ExchangeRate fx = new ExchangeRate("EUR", "MAD", new BigDecimal("10.80"), date);

            when(exchangeRateRepository.findLatestRate("EUR", "MAD", date))
                .thenReturn(Optional.of(fx));

            BigDecimal rate = providerService.getRate("EUR", "MAD", date);

            assertThat(rate).isEqualByComparingTo("10.80");
        }

        @Test
        void shouldFallbackToInverseRate() {
            when(exchangeRateRepository.findLatestRate("MAD", "EUR", date))
                .thenReturn(Optional.empty());

            ExchangeRate inverseFx = new ExchangeRate("EUR", "MAD", new BigDecimal("10.00"), date);
            when(exchangeRateRepository.findLatestRate("EUR", "MAD", date))
                .thenReturn(Optional.of(inverseFx));

            // When asking MAD → EUR, first finds nothing for MAD/EUR direct
            // Then finds EUR/MAD = 10.00, inverts to 1/10 = 0.10
            // But the code checks direct first, then inverse
            // Direct: findLatestRate("MAD", "EUR") → empty
            // Inverse: findLatestRate("EUR", "MAD") → 10.00

            // Need to reset and re-setup mocks for this specific flow
            reset(exchangeRateRepository);
            when(exchangeRateRepository.findLatestRate("MAD", "EUR", date))
                .thenReturn(Optional.empty());
            when(exchangeRateRepository.findLatestRate("EUR", "MAD", date))
                .thenReturn(Optional.of(inverseFx));

            BigDecimal rate = providerService.getRate("MAD", "EUR", date);

            assertThat(rate).isEqualByComparingTo("0.100000");
        }

        @Test
        void shouldThrowWhenNoRateFound() {
            when(exchangeRateRepository.findLatestRate("XYZ", "ABC", date))
                .thenReturn(Optional.empty());
            when(exchangeRateRepository.findLatestRate("ABC", "XYZ", date))
                .thenReturn(Optional.empty());

            assertThatThrownBy(() -> providerService.getRate("XYZ", "ABC", date))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("XYZ")
                .hasMessageContaining("ABC");
        }
    }
}
