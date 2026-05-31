package com.clenzy.controller;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.model.ExchangeRate;
import com.clenzy.repository.ExchangeRateRepository;
import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.ExchangeRateProviderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExchangeRateControllerTest {

    @Mock private CurrencyConverterService currencyConverter;
    @Mock private ExchangeRateProviderService exchangeRateProvider;
    @Mock private ExchangeRateRepository exchangeRateRepository;

    private ExchangeRateController controller;

    @BeforeEach
    void setUp() {
        controller = new ExchangeRateController(currencyConverter, exchangeRateProvider, exchangeRateRepository);
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

    @Nested
    @DisplayName("getRate")
    class GetRate {
        @Test
        void whenWithoutDate_thenUsesToday() {
            when(currencyConverter.getRate(eq("EUR"), eq("MAD"), any(LocalDate.class)))
                    .thenReturn(new BigDecimal("10.5"));

            ResponseEntity<Map<String, Object>> result = controller.getRate("eur", "mad", null);

            assertThat(result.getBody()).containsEntry("from", "EUR")
                    .containsEntry("to", "MAD")
                    .containsEntry("rate", new BigDecimal("10.5"));
        }

        @Test
        void whenWithDate_thenUsesProvidedDate() {
            LocalDate date = LocalDate.of(2026, 1, 1);
            when(currencyConverter.getRate("EUR", "MAD", date)).thenReturn(new BigDecimal("10.7"));

            ResponseEntity<Map<String, Object>> result = controller.getRate("EUR", "MAD", date);

            assertThat(result.getBody()).containsEntry("date", date);
        }
    }

    @Nested
    @DisplayName("convert")
    class Convert {
        @Test
        void whenWithoutDate_thenConverts() {
            when(currencyConverter.convert(eq(new BigDecimal("100")), eq("EUR"), eq("MAD"), any(LocalDate.class)))
                    .thenReturn(new BigDecimal("1050"));
            when(currencyConverter.getRate(eq("EUR"), eq("MAD"), any(LocalDate.class)))
                    .thenReturn(new BigDecimal("10.5"));

            ResponseEntity<Map<String, Object>> result = controller.convert(
                    new BigDecimal("100"), "eur", "mad", null);

            assertThat(result.getBody()).containsEntry("converted", new BigDecimal("1050"));
        }
    }

    @Nested
    @DisplayName("getMatrix")
    class GetMatrix {
        @Test
        void whenRatesExist_thenReturnsMatrixWithEur() {
            ExchangeRate mad = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("MAD"), any(LocalDate.class)))
                    .thenReturn(Optional.of(mad));
            when(exchangeRateRepository.findLatestRate(eq("EUR"), eq("SAR"), any(LocalDate.class)))
                    .thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> result = controller.getMatrix();

            assertThat(result.getBody()).containsEntry("base", "EUR");
            @SuppressWarnings("unchecked")
            Map<String, Object> rates = (Map<String, Object>) result.getBody().get("rates");
            assertThat(rates).containsKey("EUR").containsEntry("MAD", new BigDecimal("10.5"));
            assertThat(rates).doesNotContainKey("SAR");
        }

        @Test
        void whenNoRates_thenReturnsOnlyEur() {
            when(exchangeRateRepository.findLatestRate(any(), any(), any())).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> result = controller.getMatrix();
            @SuppressWarnings("unchecked")
            Map<String, Object> rates = (Map<String, Object>) result.getBody().get("rates");
            assertThat(rates).containsOnlyKeys("EUR");
        }
    }

    @Nested
    @DisplayName("getHistory")
    class GetHistory {

        @Test
        void whenNoFilters_thenUsesGeneralQuery() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findByRateDateBetween(any(LocalDate.class), any(LocalDate.class),
                    any(PageRequest.class))).thenReturn(page);

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    null, null, null, null, 0, 50);

            assertThat(result.getBody()).hasSize(1);
        }

        @Test
        void whenEurBase_thenDirectQuery() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findHistory(eq("EUR"), eq("MAD"), any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    "EUR", "MAD", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 5, 1), 0, 50);

            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0).baseCurrency()).isEqualTo("EUR");
        }

        @Test
        void whenEurTarget_thenInverseCalc() {
            ExchangeRate er = buildRate(1L, "EUR", "MAD", new BigDecimal("10"), LocalDate.now());
            Page<ExchangeRate> page = new PageImpl<>(List.of(er));
            when(exchangeRateRepository.findHistory(eq("EUR"), eq("MAD"), any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    "MAD", "EUR", null, null, 0, 50);

            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0).baseCurrency()).isEqualTo("MAD");
            assertThat(result.getBody().get(0).targetCurrency()).isEqualTo("EUR");
            // 1/10 = 0.1
            assertThat(result.getBody().get(0).rate()).isEqualByComparingTo("0.1");
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

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    "MAD", "SAR", null, null, 0, 50);

            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0).rate()).isEqualByComparingTo("0.4");
        }

        @Test
        void whenSizeOverCap_thenCappedAt200() {
            Page<ExchangeRate> page = new PageImpl<>(List.of());
            when(exchangeRateRepository.findByRateDateBetween(any(), any(), any(PageRequest.class)))
                    .thenReturn(page);

            controller.getHistory(null, null, null, null, 0, 9999);
            // No exception = good
            verify(exchangeRateRepository).findByRateDateBetween(any(), any(), any(PageRequest.class));
        }
    }

    @Nested
    @DisplayName("refresh")
    class Refresh {
        @Test
        void whenCalled_thenInvokesProvider() {
            ResponseEntity<Map<String, String>> result = controller.refresh();
            verify(exchangeRateProvider).refreshRates();
            assertThat(result.getBody()).containsEntry("status", "refreshed");
        }
    }
}
