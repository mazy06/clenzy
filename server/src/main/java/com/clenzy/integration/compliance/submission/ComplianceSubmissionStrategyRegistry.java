package com.clenzy.integration.compliance.submission;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

/**
 * Registry des {@link ComplianceSubmissionStrategy} indexées par provider.
 * Spring injecte toutes les implémentations ; on les range par enum.
 * Mirror de {@code ComplianceConnectionTestStrategyRegistry}.
 */
@Component
public class ComplianceSubmissionStrategyRegistry {

    private final EnumMap<ComplianceProviderType, ComplianceSubmissionStrategy> byType =
            new EnumMap<>(ComplianceProviderType.class);

    public ComplianceSubmissionStrategyRegistry(List<ComplianceSubmissionStrategy> strategies) {
        for (ComplianceSubmissionStrategy s : strategies) {
            byType.put(s.provider(), s);
        }
    }

    public Optional<ComplianceSubmissionStrategy> findFor(ComplianceProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
