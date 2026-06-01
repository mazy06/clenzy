package com.clenzy.service;

import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

        @Test
        void shouldNormalizeBaseToUpperCaseWhenLookingUp() {
            ExchangeRate fx = new ExchangeRate("USD", "EUR", new BigDecimal("0.92"), date);
            when(exchangeRateRepository.findLatestRate("USD", "EUR", date))
                .thenReturn(Optional.of(fx));

            BigDecimal rate = providerService.getRate("usd", "eur", date);

            assertThat(rate).isEqualByComparingTo("0.92");
            verify(exchangeRateRepository).findLatestRate("USD", "EUR", date);
        }

        @Test
        void shouldNotDivideByZeroIfInverseRateIsZero() {
            ExchangeRate zeroFx = new ExchangeRate("EUR", "MAD", BigDecimal.ZERO, date);
            when(exchangeRateRepository.findLatestRate("MAD", "EUR", date))
                .thenReturn(Optional.empty());
            when(exchangeRateRepository.findLatestRate("EUR", "MAD", date))
                .thenReturn(Optional.of(zeroFx));

            assertThatThrownBy(() -> providerService.getRate("MAD", "EUR", date))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    class InitRatesOnStartup {

        @Test
        void shouldNotFetchWhenAllRatesPresentForToday() {
            LocalDate today = LocalDate.now();
            when(exchangeRateRepository.findLatestRate(eq("EUR"), anyString(), eq(today)))
                .thenReturn(Optional.of(new ExchangeRate("EUR", "MAD", new BigDecimal("10.80"), today)));

            providerService.initRatesOnStartup();

            // No restTemplate call since rates already exist
            verifyNoInteractions(restTemplate);
        }

        @Test
        void shouldFetchRatesWhenMissingAtStartup() {
            LocalDate today = LocalDate.now();
            // MAD missing — should trigger fetch
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("MAD"), eq(today)))
                .thenReturn(Optional.empty());
            // RestTemplate returns null → no save
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(null);

            providerService.initRatesOnStartup();

            verify(restTemplate).getForObject(anyString(), eq(Map.class));
        }

        @Test
        void shouldSwallowExceptionsAtStartup() {
            LocalDate today = LocalDate.now();
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("MAD"), eq(today)))
                .thenReturn(Optional.empty());
            when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenThrow(new RestClientException("network down"));

            // Should NOT throw — must be swallowed at startup
            assertThatCode(() -> providerService.initRatesOnStartup()).doesNotThrowAnyException();
        }
    }

    @Nested
    class FetchDailyRates {

        @Test
        @SuppressWarnings("unchecked")
        void shouldFetchAndSaveBothTargetCurrencies() {
            Map<String, Object> response = new HashMap<>();
            Map<String, Number> rates = new HashMap<>();
            rates.put("MAD", new BigDecimal("10.85"));
            rates.put("SAR", new BigDecimal("3.95"));
            response.put("rates", rates);

            LocalDate today = LocalDate.now();
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);
            when(exchangeRateRepository.findByBaseCurrencyAndTargetCurrencyAndRateDate(
                eq("EUR"), anyString(), eq(today)))
                .thenReturn(Optional.empty());

            providerService.fetchDailyRates();

            ArgumentCaptor<ExchangeRate> captor = ArgumentCaptor.forClass(ExchangeRate.class);
            verify(exchangeRateRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues())
                .extracting(ExchangeRate::getTargetCurrency)
                .containsExactlyInAnyOrder("MAD", "SAR");
            assertThat(captor.getAllValues())
                .extracting(ExchangeRate::getSource)
                .containsOnly("OPEN_ER");
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldSkipExistingRatesByTargetCurrency() {
            Map<String, Object> response = new HashMap<>();
            Map<String, Number> rates = new HashMap<>();
            rates.put("MAD", new BigDecimal("10.85"));
            rates.put("SAR", new BigDecimal("3.95"));
            response.put("rates", rates);

            LocalDate today = LocalDate.now();
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);
            // MAD exists, SAR doesn't
            when(exchangeRateRepository.findByBaseCurrencyAndTargetCurrencyAndRateDate(
                "EUR", "MAD", today))
                .thenReturn(Optional.of(new ExchangeRate("EUR", "MAD", new BigDecimal("10.85"), today)));
            when(exchangeRateRepository.findByBaseCurrencyAndTargetCurrencyAndRateDate(
                "EUR", "SAR", today))
                .thenReturn(Optional.empty());

            providerService.fetchDailyRates();

            // Only SAR saved (MAD already exists)
            verify(exchangeRateRepository, times(1)).save(any(ExchangeRate.class));
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldHandleNullResponseFromApi() {
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(null);

            assertThatCode(() -> providerService.fetchDailyRates()).doesNotThrowAnyException();
            verify(exchangeRateRepository, never()).save(any());
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldHandleResponseWithoutRatesKey() {
            Map<String, Object> response = new HashMap<>();
            response.put("error", "api-down");
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

            assertThatCode(() -> providerService.fetchDailyRates()).doesNotThrowAnyException();
            verify(exchangeRateRepository, never()).save(any());
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldHandleResponseMissingTargetCurrencies() {
            Map<String, Object> response = new HashMap<>();
            Map<String, Number> rates = new HashMap<>();
            rates.put("USD", new BigDecimal("1.08")); // not MAD or SAR
            response.put("rates", rates);

            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

            providerService.fetchDailyRates();
            // No saves because MAD/SAR not in response
            verify(exchangeRateRepository, never()).save(any());
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldSwallowExceptionFromApi() {
            when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenThrow(new RestClientException("connect timeout"));

            assertThatCode(() -> providerService.fetchDailyRates()).doesNotThrowAnyException();
        }
    }

    @Nested
    class RefreshRates {

        @Test
        @SuppressWarnings("unchecked")
        void shouldDelegateToFetchDailyRates() {
            when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(null);

            providerService.refreshRates();

            verify(restTemplate).getForObject(anyString(), eq(Map.class));
        }
    }
}
