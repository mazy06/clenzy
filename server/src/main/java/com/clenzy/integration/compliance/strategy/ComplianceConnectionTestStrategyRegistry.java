package com.clenzy.integration.compliance.strategy;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

/**
 * Registry des strategies de test de connexion par provider compliance.
 * Spring injecte toutes les implementations et on les indexe par enum.
 */
@Component
public class ComplianceConnectionTestStrategyRegistry {

    private final EnumMap<ComplianceProviderType, ComplianceConnectionTestStrategy> byType =
            new EnumMap<>(ComplianceProviderType.class);

    public ComplianceConnectionTestStrategyRegistry(List<ComplianceConnectionTestStrategy> strategies) {
        for (ComplianceConnectionTestStrategy s : strategies) {
            byType.put(s.providerType(), s);
        }
    }

    public Optional<ComplianceConnectionTestStrategy> findFor(ComplianceProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
