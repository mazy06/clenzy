package com.clenzy.service.marketdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;

/**
 * Adaptateur <b>Airbtics</b> — fournisseur CIBLE de la roadmap market data
 * (~500-2 000 $/an, couverture Maroc profonde, restitution native en MAD).
 *
 * <p><b>DORMANT sans clé</b> ({@code clenzy.rms.market-data.airbtics.api-key},
 * vide par défaut) : le jour de l'achat de l'abonnement, poser la clé + l'URL
 * suffit — aucun re-développement. Au premier appel réel, confirmer le schéma
 * de réponse et ajuster si besoin la seule couche {@code parse} de
 * {@link RestMarketDataProvider}.</p>
 */
@Service
public class AirbticsMarketDataProvider extends RestMarketDataProvider {

    /** Fiabilité de base : données OTA larges et fraîches, mais prix affichés (pas vendus). */
    private static final BigDecimal BASE_CONFIDENCE = new BigDecimal("0.80");

    public AirbticsMarketDataProvider(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            MarketDataConnectionService connectionService,
            @Value("${clenzy.rms.market-data.airbtics.api-key:}") String fallbackApiKey,
            @Value("${clenzy.rms.market-data.airbtics.base-url:https://api.airbtics.com/v1/market}") String baseUrl,
            @Value("${clenzy.rms.market-data.markets:Marrakech:MA,Casablanca:MA,Agadir:MA}") String markets) {
        super(restTemplate, objectMapper, connectionService, fallbackApiKey, baseUrl, markets);
    }

    @Override
    public MarketDataProviderType type() {
        return MarketDataProviderType.AIRBTICS;
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
