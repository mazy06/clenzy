package com.clenzy.service.marketdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.RestTemplate;
import com.clenzy.service.marketdata.MarketDataConnectionService;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import java.util.Optional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Providers market data : parsing open data CSV, contrat JSON normalisé des
 * adaptateurs REST, et dormance sans clé (budget zéro).
 */
class MarketDataProvidersTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MarketDataConnectionService noConnection = mockConnections(null);

    /** Service de connexions mocké : {@code key} null = aucune connexion UI activée. */
    private static MarketDataConnectionService mockConnections(String key) {
        MarketDataConnectionService svc = mock(MarketDataConnectionService.class);
        when(svc.resolveApiKey(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.ofNullable(key));
        when(svc.resolveBaseUrl(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.empty());
        return svc;
    }

    // ── Open data (CSV) ─────────────────────────────────────────────────────

    @Test
    void openData_parsesCsvAndSkipsInvalidLines(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("maroc.csv"), """
                area,country_code,stay_month,adr,occupancy_pct,revpar,currency,sample_size
                Marrakech,MA,2026-06,620,58.5,362,MAD,4100
                ligne-invalide-sans-colonnes
                Agadir,MA,2026-06,516,52.0,268,MAD,1200
                Hors-fenetre,MA,2020-01,100,10,10,MAD,50
                """);
        OpenDataMarketDataProvider provider = new OpenDataMarketDataProvider(dir.toString());

        assertThat(provider.isConfigured()).isTrue();
        List<MarketBenchmark> benchmarks =
                provider.fetchBenchmarks(YearMonth.of(2026, 1), YearMonth.of(2026, 12));

        assertThat(benchmarks).hasSize(2); // invalide + hors fenêtre ignorées
        MarketBenchmark marrakech = benchmarks.get(0);
        assertThat(marrakech.area()).isEqualTo("Marrakech");
        assertThat(marrakech.currency()).isEqualTo("MAD");
        assertThat(marrakech.adr()).isEqualByComparingTo("620.00");
        // 4100 biens -> densité pleine -> confiance = base 0.60.
        assertThat(marrakech.confidence()).isEqualByComparingTo("0.60");
    }

    @Test
    void openData_withoutDirectory_isNotConfigured() {
        assertThat(new OpenDataMarketDataProvider("").isConfigured()).isFalse();
        assertThat(new OpenDataMarketDataProvider("/inexistant/nulle-part").isConfigured()).isFalse();
    }

    // ── Adaptateurs REST dormants ───────────────────────────────────────────

    @Test
    void airbtics_withoutApiKey_isDormant() {
        AirbticsMarketDataProvider provider = new AirbticsMarketDataProvider(
                new RestTemplate(), objectMapper, noConnection, "", "https://api.airbtics.com/v1/market",
                "Marrakech:MA");
        assertThat(provider.isConfigured()).isFalse();
    }

    @Test
    void airroi_withoutApiKey_isDormant() {
        AirRoiMarketDataProvider provider = new AirRoiMarketDataProvider(
                new RestTemplate(), objectMapper, noConnection, "", "https://api.airroi.com/v1/market",
                "Marrakech:MA");
        assertThat(provider.isConfigured()).isFalse();
    }

    @Test
    void uiConnection_activatesProviderWithoutEnvKey() {
        // Clé posée dans Réglages -> Intégrations (connexion en base) : le provider
        // se réveille sans variable d'environnement ni redéploiement.
        AirbticsMarketDataProvider provider = new AirbticsMarketDataProvider(
                new RestTemplate(), objectMapper, mockConnections("cle-activee-par-ui"),
                "", "https://api.airbtics.com/v1/market", "Marrakech:MA");
        assertThat(provider.isConfigured()).isTrue();
    }

    @Test
    void restProvider_parsesNormalizedContract() {
        AirbticsMarketDataProvider provider = new AirbticsMarketDataProvider(
                new RestTemplate(), objectMapper, noConnection, "some-key", "https://api.airbtics.com/v1/market",
                "Casablanca:MA");

        List<MarketBenchmark> benchmarks = provider.parse("""
                {"data": [
                  {"area": "Casablanca", "country_code": "MA", "stay_month": "2026-07",
                   "adr": 627.4, "occupancy_pct": 61.2, "revpar": 384.0,
                   "currency": "MAD", "sample_size": 3456}
                ]}
                """, new RestMarketDataProvider.Market("Casablanca", "MA"));

        assertThat(benchmarks).hasSize(1);
        MarketBenchmark casa = benchmarks.get(0);
        assertThat(casa.stayMonth()).isEqualTo(YearMonth.of(2026, 7));
        assertThat(casa.adr()).isEqualByComparingTo("627.40");
        assertThat(casa.currency()).isEqualTo("MAD");
        // Densité pleine (3456 >= 100) -> confiance = base Airbtics 0.80.
        assertThat(casa.confidence()).isEqualByComparingTo("0.80");
    }

    @Test
    void restProvider_unreadableBody_returnsEmptyNotThrow() {
        AirbticsMarketDataProvider provider = new AirbticsMarketDataProvider(
                new RestTemplate(), objectMapper, noConnection, "some-key", "url", "Marrakech:MA");
        assertThat(provider.parse("pas-du-json", new RestMarketDataProvider.Market("Marrakech", "MA")))
                .isEmpty();
        assertThat(provider.parse(null, new RestMarketDataProvider.Market("Marrakech", "MA")))
                .isEmpty();
    }
}
