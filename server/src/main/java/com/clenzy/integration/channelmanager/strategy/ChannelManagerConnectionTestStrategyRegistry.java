package com.clenzy.integration.channelmanager.strategy;

import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

/** Registry des strategies de test par Channel Manager. */
@Component
public class ChannelManagerConnectionTestStrategyRegistry {

    private final EnumMap<ChannelManagerProviderType, ChannelManagerConnectionTestStrategy> byType =
            new EnumMap<>(ChannelManagerProviderType.class);

    public ChannelManagerConnectionTestStrategyRegistry(List<ChannelManagerConnectionTestStrategy> strategies) {
        for (ChannelManagerConnectionTestStrategy s : strategies) {
            byType.put(s.providerType(), s);
        }
    }

    public Optional<ChannelManagerConnectionTestStrategy> findFor(ChannelManagerProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
