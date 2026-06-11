package com.clenzy.controller;

import com.clenzy.dto.TaxRuleDto;
import com.clenzy.dto.TaxRuleRequest;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.model.TaxRule;
import com.clenzy.service.TaxRuleService;
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

    private final TaxRuleService taxRuleService;
    private final FiscalEngine fiscalEngine;
    private final TenantContext tenantContext;

    public TaxRuleController(TaxRuleService taxRuleService,
                              FiscalEngine fiscalEngine,
                              TenantContext tenantContext) {
        this.taxRuleService = taxRuleService;
        this.fiscalEngine = fiscalEngine;
        this.tenantContext = tenantContext;
    }

    // ─── Lecture ─────────────────────────────────────────────────────────────

    /**
     * Retourne les regles fiscales applicables pour le pays de l'organisation courante.
     */
    @GetMapping
    public ResponseEntity<List<TaxRuleDto>> getCurrentRules(
            @RequestParam(required = false) String category) {
        String countryCode = tenantContext.getCountryCode();
        return getRulesForCountry(countryCode, category);
    }

    /**
     * Retourne toutes les regles fiscales (administration).
     */
    @GetMapping("/all")
    public ResponseEntity<List<TaxRuleDto>> getAllRules() {
        return ResponseEntity.ok(toDtos(taxRuleService.findAll()));
    }

    /**
     * Retourne les regles fiscales applicables pour un pays specifique.
     */
    @GetMapping("/{countryCode}")
    public ResponseEntity<List<TaxRuleDto>> getRulesForCountry(
            @PathVariable String countryCode,
            @RequestParam(required = false) String category) {

        LocalDate today = LocalDate.now();

        if (category != null && !category.isBlank()) {
            List<TaxRule> rules = fiscalEngine.getApplicableRules(
                countryCode.toUpperCase(), category.toUpperCase(), today);
            return ResponseEntity.ok(toDtos(rules));
        }

        // Toutes les regles du pays
        List<TaxRule> rules = taxRuleService.findByCountryCode(countryCode);
        return ResponseEntity.ok(toDtos(rules));
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
    public ResponseEntity<TaxRuleDto> createRule(@Valid @RequestBody TaxRuleRequest request) {
        TaxRule saved = taxRuleService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TaxRuleDto.from(saved));
    }

    /**
     * Met a jour une regle fiscale existante.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TaxRuleDto> updateRule(
            @PathVariable Long id,
            @Valid @RequestBody TaxRuleRequest request) {
        return ResponseEntity.ok(TaxRuleDto.from(taxRuleService.update(id, request)));
    }

    /**
     * Supprime une regle fiscale.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
        taxRuleService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private List<TaxRuleDto> toDtos(List<TaxRule> rules) {
        return rules.stream().map(TaxRuleDto::from).toList();
    }
}
