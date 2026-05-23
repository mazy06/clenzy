package com.clenzy.integration.channelmanager.strategy;

import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Strategies stub — accepte toute API key non-vide en attendant le cablage. */
abstract class StubChannelManagerConnectionTestStrategy implements ChannelManagerConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(StubChannelManagerConnectionTestStrategy.class);

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        if (serverUrl == null || serverUrl.isBlank()
                || apiKey == null || apiKey.length() < 8) {
            return false;
        }
        log.info("Stub testConnection {} accepting credentials (no real API call yet)", providerType());
        return true;
    }
}

@Service
class SiteMinderConnectionTestStrategy extends StubChannelManagerConnectionTestStrategy {
    @Override public ChannelManagerProviderType providerType() { return ChannelManagerProviderType.SITEMINDER; }
}

@Service
class HostawayConnectionTestStrategy extends StubChannelManagerConnectionTestStrategy {
    @Override public ChannelManagerProviderType providerType() { return ChannelManagerProviderType.HOSTAWAY; }
}

@Service
class RentalsUnitedConnectionTestStrategy extends StubChannelManagerConnectionTestStrategy {
    @Override public ChannelManagerProviderType providerType() { return ChannelManagerProviderType.RENTALS_UNITED; }
}
