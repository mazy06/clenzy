package com.clenzy.payment;

import com.clenzy.model.PaymentProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registry des PaymentProvider par type.
 * Charge automatiquement toutes les implementations Spring au demarrage.
 * Pattern identique a TaxCalculatorRegistry.
 */
@Component
public class PaymentProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(PaymentProviderRegistry.class);

    private final Map<PaymentProviderType, PaymentProvider> providers;

    public PaymentProviderRegistry(List<PaymentProvider> allProviders) {
        this.providers = allProviders.stream()
            .collect(Collectors.toMap(PaymentProvider::getProviderType, Function.identity()));
        log.info("PaymentProviderRegistry: {} providers registered: {}",
            providers.size(), providers.keySet());
    }

    /**
     * Get a provider by type.
     * @throws UnsupportedPaymentProviderException if not found
     */
    public PaymentProvider get(PaymentProviderType type) {
        return Optional.ofNullable(providers.get(type))
            .orElseThrow(() -> new UnsupportedPaymentProviderException(type));
    }

    /**
     * Check if a provider type is registered.
     */
    public boolean isSupported(PaymentProviderType type) {
        return providers.containsKey(type);
    }

    /**
     * Get all registered provider types.
     */
    public Set<PaymentProviderType> getAvailableProviders() {
        return providers.keySet();
    }

    /**
     * Find providers that support a given country.
     */
    public List<PaymentProvider> getProvidersForCountry(String countryCode) {
        return providers.values().stream()
            .filter(p -> p.getSupportedCountries().contains(countryCode)
                      || p.getSupportedCountries().contains("*"))
            .toList();
    }
}
