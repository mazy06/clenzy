package com.clenzy.service.marketdata;

import com.clenzy.model.MarketDataSnapshot;
import com.clenzy.repository.MarketDataSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketDataIngestionServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 20);

    @Mock private MarketDataSnapshotRepository snapshotRepository;
    @Mock private MarketDataProvider provider;
    @Mock private PlatformTransactionManager transactionManager;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any()))
                .thenReturn(new SimpleTransactionStatus());
    }

    /** Le registry indexe par {@code type()} à la construction : stubber AVANT de bâtir. */
    private MarketDataIngestionService service() {
        return new MarketDataIngestionService(
                new MarketDataSourceRegistry(List.of(provider)), snapshotRepository, transactionManager);
    }

    private static MarketBenchmark benchmark(String area, String month, int sampleSize) {
        return new MarketBenchmark(area, "MA", YearMonth.parse(month),
                new BigDecimal("620.00"), new BigDecimal("58.00"), new BigDecimal("360.00"),
                "MAD", sampleSize, new BigDecimal("0.45"));
    }

    @Test
    void whenProviderConfigured_thenSnapshotReplacedForTheDay() {
        when(provider.type()).thenReturn(MarketDataProviderType.FIRST_PARTY);
        when(provider.isConfigured()).thenReturn(true);
        when(provider.fetchBenchmarks(any(), any()))
                .thenReturn(List.of(benchmark("Marrakech", "2026-06", 8)));

        service().ingestAll(TODAY);

        verify(snapshotRepository).deleteBySourceAndSnapshotDate("FIRST_PARTY", TODAY);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MarketDataSnapshot>> captor = ArgumentCaptor.forClass(List.class);
        verify(snapshotRepository).saveAll(captor.capture());
        MarketDataSnapshot row = captor.getValue().get(0);
        assertThat(row.getOrganizationId()).isNull(); // benchmark plateforme, jamais un tenant
        assertThat(row.getArea()).isEqualTo("Marrakech");
        assertThat(row.getStayMonth()).isEqualTo("2026-06");
        assertThat(row.getCurrency()).isEqualTo("MAD");
        assertThat(row.getSampleSize()).isEqualTo(8);
    }

    @Test
    void whenProviderNotConfigured_thenSkippedSilently() {
        when(provider.type()).thenReturn(MarketDataProviderType.AIRBTICS);
        when(provider.isConfigured()).thenReturn(false);

        service().ingestAll(TODAY);

        verify(snapshotRepository, org.mockito.Mockito.never()).saveAll(any());
    }

    @Test
    void confidenceScalesWithSampleAndIsCappedBelowMarket() {
        // k=5 -> 0.22 ; 20+ biens -> plafonné à 0.9 (le first-party n'est jamais « LE marché »).
        assertThat(FirstPartyMarketDataProvider.confidenceFor(5)).isEqualByComparingTo("0.23");
        assertThat(FirstPartyMarketDataProvider.confidenceFor(20)).isEqualByComparingTo("0.90");
        assertThat(FirstPartyMarketDataProvider.confidenceFor(100)).isEqualByComparingTo("0.90");
    }
}
