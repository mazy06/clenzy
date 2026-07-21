package com.clenzy.service;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
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

    private ExchangeRate buildRate(Long id, String base, String target, BigDecimal rate, LocalDate date) {
        ExchangeRate er = new ExchangeRate();
        er.setBaseCurrency(base);
        er.setTargetCurrency(target);
        er.setRate(rate);
        er.setRateDate(date);
        er.setSource("ECB");
        try {
            var f = ExchangeRate.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(er, id);
        } catch (Exception ignore) {}
        return er;
    }

    /**
     * Logique deplacee de ExchangeRateController (T-ARCH-01) : la matrice
     * des taux courants est calculee au niveau service.
     */
    @Nested
    class GetLatestMatrix {

        @Test
        void whenRatesExist_thenReturnsMatrixWithEur() {
            ExchangeRate mad = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("MAD"), any(LocalDate.class)))
                    .thenReturn(Optional.of(mad));
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("SAR"), any(LocalDate.class)))
                    .thenReturn(Optional.empty());

            ExchangeRateProviderService.RateMatrix matrix = providerService.getLatestMatrix();

            assertThat(matrix.rates()).containsKey("EUR").containsEntry("MAD", new BigDecimal("10.5"));
            assertThat(matrix.rates()).doesNotContainKey("SAR");
            assertThat(matrix.date()).isEqualTo(mad.getRateDate());
        }

        @Test
        void whenNoRates_thenReturnsOnlyEur() {
            when(exchangeRateRepository.findLatestRate(any(), any(), any())).thenReturn(Optional.empty());

            ExchangeRateProviderService.RateMatrix matrix = providerService.getLatestMatrix();

            assertThat(matrix.rates()).containsOnlyKeys("EUR");
            assertThat(matrix.date()).isNull();
        }
    }

    /**
     * Logique deplacee de ExchangeRateController (T-ARCH-01) : paires directes,
     * inverses et croisees calculees au niveau service.
     */
    @Nested
    class GetHistory {

        @Test
        void whenNoFilters_thenUsesGeneralQuery() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findByRateDateBetween(any(LocalDate.class), any(LocalDate.class),
                    any(PageRequest.class))).thenReturn(page);

            List<ExchangeRateDto> result = providerService.getHistory(null, null, null, null, 0, 50);

            assertThat(result).hasSize(1);
        }

        @Test
        void whenEurBase_thenDirectQuery() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findHistory(eq("EUR"), eq("MAD"), any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            List<ExchangeRateDto> result = providerService.getHistory(
                    "EUR", "MAD", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 5, 1), 0, 50);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).baseCurrency()).isEqualTo("EUR");
        }

        @Test
        void whenEurTarget_thenInverseCalc() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findHistory(eq("EUR"), eq("MAD"), any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            List<ExchangeRateDto> result = providerService.getHistory("MAD", "EUR", null, null, 0, 50);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).baseCurrency()).isEqualTo("MAD");
            assertThat(result.get(0).targetCurrency()).isEqualTo("EUR");
            // 1/10 = 0.1
            assertThat(result.get(0).rate()).isEqualByComparingTo("0.1");
        }

        @Test
        void whenCrossPair_thenComputesCrossRate() {
            LocalDate today = LocalDate.now();
            // EUR→MAD = 10, EUR→SAR = 4 → MAD→SAR = 4/10 = 0.4
            ExchangeRate eurMad = buildRate(1L, "EUR", "MAD", new BigDecimal("10"), today);
            ExchangeRate eurSar = buildRate(2L, "EUR", "SAR", new BigDecimal("4"), today);

            when(exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
                    eq("EUR"), eq("MAD"), any(), any())).thenReturn(List.of(eurMad));
            when(exchangeRateRepository.findAllByBaseCurrencyAndTargetCurrencyAndRateDateBetween(
                    eq("EUR"), eq("SAR"), any(), any())).thenReturn(List.of(eurSar));

            List<ExchangeRateDto> result = providerService.getHistory("MAD", "SAR", null, null, 0, 50);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).rate()).isEqualByComparingTo("0.4");
        }

        @Test
        void whenSizeOverCap_thenCappedAt200() {
            Page<ExchangeRate> page = new PageImpl<>(List.of());
            when(exchangeRateRepository.findByRateDateBetween(any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            providerService.getHistory(null, null, null, null, 0, 9999);

            ArgumentCaptor<PageRequest> captor = ArgumentCaptor.forClass(PageRequest.class);
            verify(exchangeRateRepository).findByRateDateBetween(any(), any(), captor.capture());
            assertThat(captor.getValue().getPageSize()).isEqualTo(200);
        }
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

    /**
     * Câblage du cache {@code exchange-rates} : getRate est appelé PAR LOGEMENT dans les conversions
     * du booking engine (1-2 requêtes DB par appel sinon), et les DEUX chemins d'écriture des taux
     * doivent évincer le cache — refreshRates porte sa propre annotation car son appel interne à
     * fetchDailyRates est une self-invocation qui contourne le proxy Spring.
     */
    @Nested
    class CacheWiring {

        @Test
        void getRate_isCachedInExchangeRatesWithPairAndDateKey() throws NoSuchMethodException {
            var m = ExchangeRateProviderService.class.getMethod(
                "getRate", String.class, String.class, LocalDate.class);
            var cacheable = m.getAnnotation(org.springframework.cache.annotation.Cacheable.class);

            assertThat(cacheable).isNotNull();
            assertThat(cacheable.value()).containsExactly("exchange-rates");
            assertThat(cacheable.key()).contains("#baseCurrency").contains("#targetCurrency").contains("#date");
            // Le cas identité (base == target) retourne 1 sans DB : inutile de le cacher.
            assertThat(cacheable.condition()).contains("equalsIgnoreCase");
        }

        @Test
        void bothRateWritePaths_evictExchangeRatesCache() throws NoSuchMethodException {
            for (String methodName : new String[] {"fetchDailyRates", "refreshRates"}) {
                var evict = ExchangeRateProviderService.class.getMethod(methodName)
                    .getAnnotation(org.springframework.cache.annotation.CacheEvict.class);
                assertThat(evict).as("@CacheEvict sur " + methodName).isNotNull();
                assertThat(evict.value()).containsExactly("exchange-rates");
                assertThat(evict.allEntries()).isTrue();
            }
        }
    }
}
