package com.clenzy.compliance;

import com.clenzy.fiscal.UnsupportedCountryException;
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
 * Registry des CountryComplianceStrategy par code pays.
 * Charge automatiquement toutes les implementations Spring au demarrage.
 *
 * Usage : registry.get("FR") → FranceComplianceStrategy
 */
@Component
public class ComplianceStrategyRegistry {

    private static final Logger log = LoggerFactory.getLogger(ComplianceStrategyRegistry.class);

    private final Map<String, CountryComplianceStrategy> strategies;

    public ComplianceStrategyRegistry(List<CountryComplianceStrategy> allStrategies) {
        this.strategies = allStrategies.stream()
            .collect(Collectors.toMap(CountryComplianceStrategy::getCountryCode, Function.identity()));
        log.info("ComplianceStrategyRegistry: {} strategies registered: {}",
            strategies.size(), strategies.keySet());
    }

    /**
     * Retourne la strategie de conformite pour un pays donne.
     *
     * @throws UnsupportedCountryException si le pays n'est pas supporte
     */
    public CountryComplianceStrategy get(String countryCode) {
        return Optional.ofNullable(strategies.get(countryCode))
            .orElseThrow(() -> new UnsupportedCountryException(countryCode));
    }

    /**
     * Verifie si un pays est supporte.
     */
    public boolean isSupported(String countryCode) {
        return strategies.containsKey(countryCode);
    }

    /**
     * Retourne la liste des pays supportes.
     */
    public Set<String> getSupportedCountries() {
        return strategies.keySet();
    }
}
