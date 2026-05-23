package com.clenzy.integration.pricing.strategy;

import com.clenzy.integration.pricing.model.PricingProviderType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

/**
 * Registry des strategies de test de connexion par provider pricing.
 * Spring injecte toutes les implementations de {@link PricingConnectionTestStrategy}
 * et on les indexe par {@link PricingProviderType}.
 */
@Component
public class PricingConnectionTestStrategyRegistry {

    private final EnumMap<PricingProviderType, PricingConnectionTestStrategy> byType =
            new EnumMap<>(PricingProviderType.class);

    public PricingConnectionTestStrategyRegistry(List<PricingConnectionTestStrategy> strategies) {
        for (PricingConnectionTestStrategy s : strategies) {
            byType.put(s.providerType(), s);
        }
    }

    public Optional<PricingConnectionTestStrategy> findFor(PricingProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
