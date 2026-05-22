package com.clenzy.integration.pricing.strategy;

import com.clenzy.integration.pricing.model.PricingProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Strategie stub : accepte n'importe quelles credentials non-vides. Sera
 * remplacee par une vraie implementation (appel HTTP de validation) lorsque
 * Clenzy aura un compte developpeur PriceLabs / Beyond.
 *
 * <p>Une sous-classe @Service par provider — meme pattern que les stubs
 * signature, ce qui maintient l'unicite cle->strategie dans le registry.</p>
 */
abstract class StubPricingConnectionTestStrategy implements PricingConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(StubPricingConnectionTestStrategy.class);

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
class PriceLabsConnectionTestStrategy extends StubPricingConnectionTestStrategy {
    @Override public PricingProviderType providerType() { return PricingProviderType.PRICELABS; }
}

@Service
class BeyondConnectionTestStrategy extends StubPricingConnectionTestStrategy {
    @Override public PricingProviderType providerType() { return PricingProviderType.BEYOND; }
}
