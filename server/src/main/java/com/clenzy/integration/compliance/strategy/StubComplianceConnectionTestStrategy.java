package com.clenzy.integration.compliance.strategy;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Strategies stub — accepte n'importe quelles credentials non-vides en
 * attendant le cablage des vraies APIs (Chekin / DGSN / Absher).
 *
 * <p>Une sous-classe @Service par provider pour respecter l'unicite
 * cle->strategie dans le registry.</p>
 */
abstract class StubComplianceConnectionTestStrategy implements ComplianceConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(StubComplianceConnectionTestStrategy.class);

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
class ChekinConnectionTestStrategy extends StubComplianceConnectionTestStrategy {
    @Override public ComplianceProviderType providerType() { return ComplianceProviderType.CHEKIN; }
}

@Service
class PoliceMaConnectionTestStrategy extends StubComplianceConnectionTestStrategy {
    @Override public ComplianceProviderType providerType() { return ComplianceProviderType.POLICE_MA; }
}

@Service
class AbsherKsaConnectionTestStrategy extends StubComplianceConnectionTestStrategy {
    @Override public ComplianceProviderType providerType() { return ComplianceProviderType.ABSHER_KSA; }
}
