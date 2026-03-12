package com.clenzy.controller;

import com.clenzy.dto.TaxRuleRequest;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Controller REST pour la consultation et la gestion des regles fiscales.
 *
 * Endpoints lecture :
 * - GET /api/tax-rules              → regles applicables pour le pays de l'org
 * - GET /api/tax-rules/all          → toutes les regles (administration)
 * - GET /api/tax-rules/{country}    → regles applicables pour un pays specifique
 * - GET /api/tax-rules/supported/{country} → verifie si un pays est supporte
 *
 * Endpoints ecriture (SUPER_ADMIN uniquement) :
 * - POST   /api/tax-rules           → creer une regle
 * - PUT    /api/tax-rules/{id}      → modifier une regle
 * - DELETE /api/tax-rules/{id}      → supprimer une regle
 */
@RestController
@RequestMapping("/api/tax-rules")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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

    // ─── Lecture ─────────────────────────────────────────────────────────────

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
     * Retourne toutes les regles fiscales (administration).
     */
    @GetMapping("/all")
    public ResponseEntity<List<TaxRule>> getAllRules() {
        return ResponseEntity.ok(taxRuleRepository.findAll());
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

    // ─── Ecriture (SUPER_ADMIN uniquement) ──────────────────────────────────

    /**
     * Cree une nouvelle regle fiscale.
     */
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TaxRule> createRule(@Valid @RequestBody TaxRuleRequest request) {
        TaxRule rule = new TaxRule(
            request.countryCode().toUpperCase(),
            request.taxCategory().toUpperCase(),
            request.taxRate(),
            request.taxName(),
            request.effectiveFrom()
        );
        rule.setEffectiveTo(request.effectiveTo());
        rule.setDescription(request.description());
        TaxRule saved = taxRuleRepository.save(rule);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Met a jour une regle fiscale existante.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TaxRule> updateRule(
            @PathVariable Long id,
            @Valid @RequestBody TaxRuleRequest request) {
        TaxRule rule = taxRuleRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Regle fiscale introuvable: " + id));
        rule.setCountryCode(request.countryCode().toUpperCase());
        rule.setTaxCategory(request.taxCategory().toUpperCase());
        rule.setTaxRate(request.taxRate());
        rule.setTaxName(request.taxName());
        rule.setEffectiveFrom(request.effectiveFrom());
        rule.setEffectiveTo(request.effectiveTo());
        rule.setDescription(request.description());
        return ResponseEntity.ok(taxRuleRepository.save(rule));
    }

    /**
     * Supprime une regle fiscale.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
        if (!taxRuleRepository.existsById(id)) {
            throw new IllegalArgumentException("Regle fiscale introuvable: " + id);
        }
        taxRuleRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
