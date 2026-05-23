package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

/** Registry des strategies de test par provider KYC. */
@Component
public class KycConnectionTestStrategyRegistry {

    private final EnumMap<KycProviderType, KycConnectionTestStrategy> byType =
            new EnumMap<>(KycProviderType.class);

    public KycConnectionTestStrategyRegistry(List<KycConnectionTestStrategy> strategies) {
        for (KycConnectionTestStrategy s : strategies) {
            byType.put(s.providerType(), s);
        }
    }

    public Optional<KycConnectionTestStrategy> findFor(KycProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
