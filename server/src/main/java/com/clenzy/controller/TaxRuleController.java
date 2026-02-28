package com.clenzy.controller;

import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Controller REST pour la consultation des regles fiscales.
 *
 * Endpoints :
 * - GET /api/tax-rules              → regles applicables pour le pays de l'org
 * - GET /api/tax-rules/{country}    → regles applicables pour un pays specifique
 */
@RestController
@RequestMapping("/api/tax-rules")
public class TaxRuleController {

    private final TaxRuleRepository taxRuleRepository;
    private final FiscalEngine fiscalEngine;
    private final TenantContext tenantContext;

    public TaxRuleController(TaxRuleRepository taxRuleRepository,
                              FiscalEngine fiscalEngine,
                              TenantContext tenantContext) {
        this.taxRuleRepository = taxRuleRepository;
        this.fiscalEngine = fiscalEngine;
        this.tenantContext = tenantContext;
    }

    /**
     * Retourne les regles fiscales applicables pour le pays de l'organisation courante.
     */
    @GetMapping
    public ResponseEntity<List<TaxRule>> getCurrentRules(
            @RequestParam(required = false) String category) {
        String countryCode = tenantContext.getCountryCode();
        return getRulesForCountry(countryCode, category);
    }

    /**
     * Retourne les regles fiscales applicables pour un pays specifique.
     */
    @GetMapping("/{countryCode}")
    public ResponseEntity<List<TaxRule>> getRulesForCountry(
            @PathVariable String countryCode,
            @RequestParam(required = false) String category) {

        LocalDate today = LocalDate.now();

        if (category != null && !category.isBlank()) {
            List<TaxRule> rules = fiscalEngine.getApplicableRules(
                countryCode.toUpperCase(), category.toUpperCase(), today);
            return ResponseEntity.ok(rules);
        }

        // Toutes les regles du pays
        List<TaxRule> rules = taxRuleRepository.findByCountryCode(countryCode.toUpperCase());
        return ResponseEntity.ok(rules);
    }

    /**
     * Verifie si un pays est supporte par le moteur fiscal.
     */
    @GetMapping("/supported/{countryCode}")
    public ResponseEntity<Boolean> isCountrySupported(@PathVariable String countryCode) {
        return ResponseEntity.ok(fiscalEngine.isCountrySupported(countryCode.toUpperCase()));
    }
}
