package com.clenzy.fiscal;

import com.clenzy.model.TaxRule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Facade principale du moteur fiscal.
 * Delègue les calculs au TaxCalculator du pays concerne via le registry.
 *
 * Usage typique :
 *   TaxResult result = fiscalEngine.calculateTax("FR", item, LocalDate.now());
 */
@Service
public class FiscalEngine {

    private static final Logger log = LoggerFactory.getLogger(FiscalEngine.class);

    private final TaxCalculatorRegistry registry;

    public FiscalEngine(TaxCalculatorRegistry registry) {
        this.registry = registry;
    }

    /**
     * Calcule la taxe pour un element imposable dans un pays donne.
     */
    public TaxResult calculateTax(String countryCode, TaxableItem item, LocalDate transactionDate) {
        log.debug("Calculating tax for country={}, category={}, amount={}, date={}",
            countryCode, item.taxCategory(), item.amount(), transactionDate);
        TaxCalculator calculator = registry.get(countryCode);
        return calculator.calculateTax(item, transactionDate);
    }

    /**
     * Calcule la taxe de sejour / municipality fee.
     */
    public TouristTaxResult calculateTouristTax(String countryCode, TouristTaxInput input) {
        log.debug("Calculating tourist tax for country={}, guests={}, nights={}",
            countryCode, input.guests(), input.nights());
        TaxCalculator calculator = registry.get(countryCode);
        return calculator.calculateTouristTax(input);
    }

    /**
     * Retourne les regles fiscales applicables.
     */
    public List<TaxRule> getApplicableRules(String countryCode, String taxCategory, LocalDate date) {
        TaxCalculator calculator = registry.get(countryCode);
        return calculator.getApplicableRules(taxCategory, date);
    }

    /**
     * Verifie si un pays est supporte par le moteur fiscal.
     */
    public boolean isCountrySupported(String countryCode) {
        return registry.isSupported(countryCode);
    }
}
