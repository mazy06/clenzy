package com.clenzy.fiscal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registry des TaxCalculator par code pays.
 * Charge automatiquement toutes les implementations Spring au demarrage.
 *
 * Usage : registry.get("FR") → FranceTaxCalculator
 */
@Component
public class TaxCalculatorRegistry {

    private static final Logger log = LoggerFactory.getLogger(TaxCalculatorRegistry.class);

    private final Map<String, TaxCalculator> calculators;

    public TaxCalculatorRegistry(List<TaxCalculator> allCalculators) {
        this.calculators = allCalculators.stream()
            .collect(Collectors.toMap(TaxCalculator::getCountryCode, Function.identity()));
        log.info("TaxCalculatorRegistry: {} calculators registered: {}",
            calculators.size(), calculators.keySet());
    }

    /**
     * Retourne le TaxCalculator pour un pays donne.
     *
     * @throws UnsupportedCountryException si le pays n'est pas supporte
     */
    public TaxCalculator get(String countryCode) {
        return Optional.ofNullable(calculators.get(countryCode))
            .orElseThrow(() -> new UnsupportedCountryException(countryCode));
    }

    /**
     * Verifie si un pays est supporte.
     */
    public boolean isSupported(String countryCode) {
        return calculators.containsKey(countryCode);
    }

    /**
     * Retourne la liste des pays supportes.
     */
    public java.util.Set<String> getSupportedCountries() {
        return calculators.keySet();
    }
}
