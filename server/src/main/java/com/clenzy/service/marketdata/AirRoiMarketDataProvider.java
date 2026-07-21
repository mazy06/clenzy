package com.clenzy.service.marketdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;

/**
 * Adaptateur <b>AirROI</b> — appoint pay-per-call de la roadmap market data
 * (~0,01 $/appel sans contrat : 5 marchés en refresh quotidien ≈ 18 $/an).
 *
 * <p><b>DORMANT sans clé</b> ({@code clenzy.rms.market-data.airroi.api-key},
 * vide par défaut). Sert de cross-check du first-party et des marchés où les
 * autres sources sont minces. Même contrat normalisé que
 * {@link RestMarketDataProvider} — schéma vendeur à confirmer à l'activation.</p>
 */
@Service
public class AirRoiMarketDataProvider extends RestMarketDataProvider {

    /** Fiabilité de base : large couverture mais marque moins établie — cross-check. */
    private static final BigDecimal BASE_CONFIDENCE = new BigDecimal("0.75");

    public AirRoiMarketDataProvider(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            MarketDataConnectionService connectionService,
            @Value("${clenzy.rms.market-data.airroi.api-key:}") String fallbackApiKey,
            @Value("${clenzy.rms.market-data.airroi.base-url:https://api.airroi.com/v1/market}") String baseUrl,
            @Value("${clenzy.rms.market-data.markets:Marrakech:MA,Casablanca:MA,Agadir:MA}") String markets) {
        super(restTemplate, objectMapper, connectionService, fallbackApiKey, baseUrl, markets);
    }

    @Override
    public MarketDataProviderType type() {
        return MarketDataProviderType.AIRROI;
    }

    @Override
    protected BigDecimal baseConfidence() {
        return BASE_CONFIDENCE;
    }

    @Override
    protected String apiKeyHeader() {
        return "X-API-Key";
    }
}
