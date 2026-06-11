package com.clenzy.controller;

import com.clenzy.dto.ExchangeRateDto;
import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.ExchangeRateProviderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de ExchangeRateController.
 *
 * NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus
 * ExchangeRateRepository. La logique matrice / historique (paires directes,
 * inverses, croisees, cap de pagination) est testee dans
 * com.clenzy.service.ExchangeRateProviderServiceTest (GetLatestMatrix, GetHistory).
 */
@ExtendWith(MockitoExtension.class)
class ExchangeRateControllerTest {

    @Mock private CurrencyConverterService currencyConverter;
    @Mock private ExchangeRateProviderService exchangeRateProvider;

    private ExchangeRateController controller;

    @BeforeEach
    void setUp() {
        controller = new ExchangeRateController(currencyConverter, exchangeRateProvider);
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
            Map<String, BigDecimal> rates = new LinkedHashMap<>();
            rates.put("EUR", BigDecimal.ONE);
            rates.put("MAD", new BigDecimal("10.5"));
            LocalDate today = LocalDate.now();
            when(exchangeRateProvider.getLatestMatrix())
                    .thenReturn(new ExchangeRateProviderService.RateMatrix(today, rates));

            ResponseEntity<Map<String, Object>> result = controller.getMatrix();

            assertThat(result.getBody()).containsEntry("base", "EUR");
            assertThat(result.getBody()).containsEntry("date", today.toString());
            @SuppressWarnings("unchecked")
            Map<String, Object> bodyRates = (Map<String, Object>) result.getBody().get("rates");
            assertThat(bodyRates).containsKey("EUR").containsEntry("MAD", new BigDecimal("10.5"));
            assertThat(bodyRates).doesNotContainKey("SAR");
        }

        @Test
        void whenNoRates_thenDateIsEmptyString() {
            Map<String, BigDecimal> rates = new LinkedHashMap<>();
            rates.put("EUR", BigDecimal.ONE);
            when(exchangeRateProvider.getLatestMatrix())
                    .thenReturn(new ExchangeRateProviderService.RateMatrix(null, rates));

            ResponseEntity<Map<String, Object>> result = controller.getMatrix();

            assertThat(result.getBody()).containsEntry("date", "");
            @SuppressWarnings("unchecked")
            Map<String, Object> bodyRates = (Map<String, Object>) result.getBody().get("rates");
            assertThat(bodyRates).containsOnlyKeys("EUR");
        }
    }

    @Nested
    @DisplayName("getHistory")
    class GetHistory {
        @Test
        void whenCalled_thenDelegatesToProvider() {
            ExchangeRateDto dto = new ExchangeRateDto(
                    1L, "EUR", "MAD", new BigDecimal("10.5"), LocalDate.now(), "ECB");
            when(exchangeRateProvider.getHistory("EUR", "MAD",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 5, 1), 0, 50))
                    .thenReturn(List.of(dto));

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    "EUR", "MAD", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 5, 1), 0, 50);

            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0).baseCurrency()).isEqualTo("EUR");
        }

        @Test
        void whenNoFilters_thenPassesNulls() {
            when(exchangeRateProvider.getHistory(isNull(), isNull(), isNull(), isNull(), eq(0), eq(50)))
                    .thenReturn(List.of());

            ResponseEntity<List<ExchangeRateDto>> result = controller.getHistory(
                    null, null, null, null, 0, 50);

            assertThat(result.getBody()).isEmpty();
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
