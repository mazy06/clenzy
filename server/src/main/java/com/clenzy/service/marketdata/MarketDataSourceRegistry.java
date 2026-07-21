package com.clenzy.service.marketdata;

import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Registre des sources de données de marché — indexe les beans
 * {@link MarketDataProvider} par type (même pattern que les registries de
 * connecteurs). Une source absente ou non configurée n'est jamais une erreur.
 */
@Component
public class MarketDataSourceRegistry {

    private final Map<MarketDataProviderType, MarketDataProvider> providers =
            new EnumMap<>(MarketDataProviderType.class);

    public MarketDataSourceRegistry(List<MarketDataProvider> beans) {
        beans.forEach(p -> providers.put(p.type(), p));
    }

    public Optional<MarketDataProvider> resolve(MarketDataProviderType type) {
        return Optional.ofNullable(providers.get(type));
    }

    /** Sources réellement activables (bean présent ET configuré). */
    public List<MarketDataProvider> configured() {
        return providers.values().stream().filter(MarketDataProvider::isConfigured).toList();
    }
}
