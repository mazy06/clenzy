package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Strategies stub — acceptent toute API key non-vide en attendant le
 * cablage des vraies APIs (Sumsub, Veriff, Onfido).
 */
abstract class StubKycConnectionTestStrategy implements KycConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(StubKycConnectionTestStrategy.class);

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
class SumsubConnectionTestStrategy extends StubKycConnectionTestStrategy {
    @Override public KycProviderType providerType() { return KycProviderType.SUMSUB; }
}

@Service
class VeriffConnectionTestStrategy extends StubKycConnectionTestStrategy {
    @Override public KycProviderType providerType() { return KycProviderType.VERIFF; }
}

@Service
class OnfidoConnectionTestStrategy extends StubKycConnectionTestStrategy {
    @Override public KycProviderType providerType() { return KycProviderType.ONFIDO; }
}
