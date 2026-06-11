package com.clenzy.service;

import com.clenzy.dto.TaxRuleRequest;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Gestion des regles fiscales. Extrait de TaxRuleController (audit T-ARCH-01,
 * regle 4 « Lecons de l'audit 2026-06 »).
 *
 * <p>Les regles fiscales sont des donnees PLATEFORME (pas d'organization_id sur
 * l'entite TaxRule) : aucune validation d'org possible/applicable — l'acces est
 * restreint au staff plateforme via @PreAuthorize sur TaxRuleController
 * (lecture SUPER_ADMIN/SUPER_MANAGER, ecriture SUPER_ADMIN).</p>
 */
@Service
public class TaxRuleService {

    private final TaxRuleRepository taxRuleRepository;

    public TaxRuleService(TaxRuleRepository taxRuleRepository) {
        this.taxRuleRepository = taxRuleRepository;
    }

    /** Toutes les regles fiscales (administration). */
    @Transactional(readOnly = true)
    public List<TaxRule> findAll() {
        return taxRuleRepository.findAll();
    }

    /** Regles d'un pays (code normalise en majuscules). */
    @Transactional(readOnly = true)
    public List<TaxRule> findByCountryCode(String countryCode) {
        return taxRuleRepository.findByCountryCode(countryCode.toUpperCase());
    }

    /** Cree une nouvelle regle fiscale (pays/categorie normalises en majuscules). */
    @Transactional
    public TaxRule create(TaxRuleRequest request) {
        TaxRule rule = new TaxRule(
            request.countryCode().toUpperCase(),
            request.taxCategory().toUpperCase(),
            request.taxRate(),
            request.taxName(),
            request.effectiveFrom()
        );
        rule.setEffectiveTo(request.effectiveTo());
        rule.setDescription(request.description());
        return taxRuleRepository.save(rule);
    }

    /** Met a jour une regle fiscale existante. */
    @Transactional
    public TaxRule update(Long id, TaxRuleRequest request) {
        TaxRule rule = taxRuleRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Regle fiscale introuvable: " + id));
        rule.setCountryCode(request.countryCode().toUpperCase());
        rule.setTaxCategory(request.taxCategory().toUpperCase());
        rule.setTaxRate(request.taxRate());
        rule.setTaxName(request.taxName());
        rule.setEffectiveFrom(request.effectiveFrom());
        rule.setEffectiveTo(request.effectiveTo());
        rule.setDescription(request.description());
        return taxRuleRepository.save(rule);
    }

    /** Supprime une regle fiscale. */
    @Transactional
    public void delete(Long id) {
        if (!taxRuleRepository.existsById(id)) {
            throw new IllegalArgumentException("Regle fiscale introuvable: " + id);
        }
        taxRuleRepository.deleteById(id);
    }
}
