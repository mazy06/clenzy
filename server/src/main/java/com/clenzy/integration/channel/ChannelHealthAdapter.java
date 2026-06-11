package com.clenzy.integration.channel;

import com.clenzy.service.ChannelHealthPort;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Adaptateur infrastructure du port {@link ChannelHealthPort} (T-ARCH-06).
 *
 * <p>Seul point de passage des health checks vers le
 * {@link ChannelConnectorRegistry} : l'integration depend de l'application
 * (implementation du port declare cote service/), jamais l'inverse.</p>
 */
@Component
public class ChannelHealthAdapter implements ChannelHealthPort {

    private final ChannelConnectorRegistry connectorRegistry;

    public ChannelHealthAdapter(ChannelConnectorRegistry connectorRegistry) {
        this.connectorRegistry = connectorRegistry;
    }

    @Override
    public String checkHealth(String channelName, Long connectionId) {
        Optional<ChannelConnector> connector =
            connectorRegistry.getConnector(ChannelName.valueOf(channelName));
        if (connector.isEmpty()) {
            return HealthStatus.UNKNOWN.name();
        }
        return connector.get().checkHealth(connectionId).name();
    }
}
