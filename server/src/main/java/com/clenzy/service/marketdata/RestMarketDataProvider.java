package com.clenzy.service.marketdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Base des adaptateurs market data REST payants (Airbtics, AirROI) — écrits et
 * testés dès la Phase 0, <b>dormants</b> tant qu'aucune clé API n'est activée.
 *
 * <p><b>Activation par l'UI</b> : la clé se saisit dans Réglages → Intégrations →
 * Intelligence de marché (staff plateforme) et est stockée chiffrée
 * ({@link MarketDataConnectionService}). Repli : propriété de configuration
 * ({@code clenzy.rms.market-data.<provider>.api-key}) pour les environnements
 * pilotés par l'infra. La résolution se fait À CHAQUE cycle d'ingestion —
 * activer une clé prend effet au prochain run, sans redéploiement.</p>
 *
 * <p><b>Contrat de réponse normalisé</b> (couche de mapping volontairement fine) :
 * un tableau JSON d'objets {@code {area, country_code, stay_month, adr,
 * occupancy_pct, revpar, currency, sample_size}}. Si le schéma réel du vendeur
 * diffère au premier appel (compte activé), SEULE la méthode {@link #parse}
 * bouge — le port, l'ingestion et la persistance restent inchangés. Les marchés
 * interrogés viennent de {@code clenzy.rms.market-data.markets}
 * (format {@code Ville:CC,Ville:CC}).</p>
 */
abstract class RestMarketDataProvider implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(RestMarketDataProvider.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final MarketDataConnectionService connectionService;
    private final String fallbackApiKey;
    private final String defaultBaseUrl;
    private final List<Market> markets;

    protected RestMarketDataProvider(RestTemplate restTemplate, ObjectMapper objectMapper,
                                     MarketDataConnectionService connectionService,
                                     String fallbackApiKey, String defaultBaseUrl, String marketsSpec) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.connectionService = connectionService;
        this.fallbackApiKey = fallbackApiKey;
        this.defaultBaseUrl = defaultBaseUrl;
        this.markets = parseMarkets(marketsSpec);
    }

    /** Fiabilité de base de la source (multipliée par la densité de l'échantillon). */
    protected abstract BigDecimal baseConfidence();

    /** Nom du header d'authentification du vendeur. */
    protected abstract String apiKeyHeader();

    @Override
    public boolean isConfigured() {
        return resolveApiKey().isPresent() && !markets.isEmpty();
    }

    @Override
    public List<MarketBenchmark> fetchBenchmarks(YearMonth fromInclusive, YearMonth toInclusive) {
        final Optional<String> apiKey = resolveApiKey();
        if (apiKey.isEmpty()) {
            return List.of();
        }
        final String baseUrl = connectionService.resolveBaseUrl(type()).orElse(defaultBaseUrl);
        final List<MarketBenchmark> benchmarks = new ArrayList<>();
        final HttpHeaders headers = new HttpHeaders();
        headers.set(apiKeyHeader(), apiKey.get());
        for (Market market : markets) {
            try {
                final String url = String.format("%s?area=%s&country=%s&from=%s&to=%s",
                        baseUrl, market.area(), market.countryCode(), fromInclusive, toInclusive);
                final String body = restTemplate.exchange(
                        url, HttpMethod.GET, new HttpEntity<>(headers), String.class).getBody();
                benchmarks.addAll(parse(body, market));
            } catch (RuntimeException e) {
                // Une zone en échec ne bloque pas les autres (quota, marché inconnu...).
                log.warn("Market data {} : échec marché {} : {}", type(), market.area(), e.getMessage());
            }
        }
        return benchmarks;
    }

    /** Clé activée par l'UI (connexion en base, chiffrée) — repli configuration infra. */
    private Optional<String> resolveApiKey() {
        return connectionService.resolveApiKey(type())
                .filter(key -> !key.isBlank())
                .or(() -> Optional.ofNullable(fallbackApiKey).filter(key -> !key.isBlank()));
    }

    /** Mapping du contrat normalisé — la SEULE couche à ajuster si le schéma vendeur diffère. */
    List<MarketBenchmark> parse(String body, Market market) {
        final List<MarketBenchmark> out = new ArrayList<>();
        if (body == null || body.isBlank()) {
            return out;
        }
        try {
            final JsonNode root = objectMapper.readTree(body);
            final JsonNode rows = root.isArray() ? root : root.path("data");
            for (JsonNode row : rows) {
                final int sampleSize = row.path("sample_size").asInt(0);
                out.add(new MarketBenchmark(
                        row.path("area").asText(market.area()),
                        row.hasNonNull("country_code")
                                ? row.get("country_code").asText() : market.countryCode(),
                        YearMonth.parse(row.path("stay_month").asText()),
                        decimalOrNull(row, "adr"),
                        decimalOrNull(row, "occupancy_pct"),
                        decimalOrNull(row, "revpar"),
                        row.hasNonNull("currency") ? row.get("currency").asText() : null,
                        sampleSize,
                        confidenceFor(sampleSize)));
            }
        } catch (Exception e) {
            log.warn("Market data {} : réponse illisible pour {} : {}", type(), market.area(), e.getMessage());
        }
        return out;
    }

    private BigDecimal confidenceFor(int sampleSize) {
        final double density = Math.min(1.0, sampleSize / 100.0);
        return baseConfidence().multiply(BigDecimal.valueOf(density)).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal decimalOrNull(JsonNode row, String field) {
        return row.hasNonNull(field)
                ? BigDecimal.valueOf(row.get(field).asDouble()).setScale(2, RoundingMode.HALF_UP)
                : null;
    }

    private static List<Market> parseMarkets(String spec) {
        final List<Market> markets = new ArrayList<>();
        if (spec == null || spec.isBlank()) {
            return markets;
        }
        for (String token : spec.split(",")) {
            final String[] parts = token.trim().split(":");
            if (parts.length == 2 && !parts[0].isBlank()) {
                markets.add(new Market(parts[0].trim(), parts[1].trim()));
            }
        }
        return markets;
    }

    record Market(String area, String countryCode) {
    }
}
