package com.clenzy.service;

import com.clenzy.compliance.ComplianceStrategyRegistry;
import com.clenzy.compliance.CountryComplianceStrategy;
import com.clenzy.model.DocumentNumberSequence;
import com.clenzy.model.DocumentType;
import com.clenzy.repository.DocumentNumberSequenceRepository;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Service de numerotation sequentielle sans trous pour les documents comptables.
 * <p>
 * Format : {PREFIX}-{ANNEE}-{NUMERO_5_CHIFFRES}
 * Exemples : FAC-2025-00001, DEV-2025-00042, INV-2026-00001
 * <p>
 * Le prefixe est resolu par ordre de priorite :
 * 1. FiscalProfile.invoicePrefix (si FACTURE et defini)
 * 2. CountryComplianceStrategy.getDefaultPrefix() (defaut par pays)
 * <p>
 * Les types de documents necessitant une numerotation sont determines
 * par la strategie de conformite du pays de l'organisation.
 * <p>
 * Utilise un verrouillage pessimiste (SELECT ... FOR UPDATE) sur la table
 * document_number_sequences pour garantir l'absence de trous meme en
 * cas de requetes concurrentes.
 */
@Service
public class DocumentNumberingService {

    private static final Logger log = LoggerFactory.getLogger(DocumentNumberingService.class);

    private final DocumentNumberSequenceRepository sequenceRepository;
    private final TenantContext tenantContext;
    private final ComplianceStrategyRegistry strategyRegistry;
    private final FiscalProfileRepository fiscalProfileRepository;

    public DocumentNumberingService(DocumentNumberSequenceRepository sequenceRepository,
                                    TenantContext tenantContext,
                                    ComplianceStrategyRegistry strategyRegistry,
                                    FiscalProfileRepository fiscalProfileRepository) {
        this.sequenceRepository = sequenceRepository;
        this.tenantContext = tenantContext;
        this.strategyRegistry = strategyRegistry;
        this.fiscalProfileRepository = fiscalProfileRepository;
    }

    /**
     * Genere le prochain numero legal pour un type de document.
     * Thread-safe grace au verrouillage pessimiste.
     *
     * @param type Type de document (FACTURE, DEVIS, etc.)
     * @return Numero legal formate (ex: FAC-2025-00001)
     * @throws IllegalArgumentException si le type ne requiert pas de numerotation pour le pays courant
     */
    @Transactional
    public String generateNextNumber(DocumentType type) {
        String countryCode = tenantContext.getCountryCode();
        CountryComplianceStrategy strategy = strategyRegistry.get(countryCode);

        if (!strategy.requiresLegalNumber(type)) {
            throw new IllegalArgumentException(
                "Le type " + type + " ne requiert pas de numerotation legale pour " + countryCode
                    + " (" + strategy.getStandardName() + ")");
        }

        String prefix = resolvePrefix(type, strategy);
        int currentYear = LocalDate.now().getYear();

        // Verrouillage pessimiste : SELECT ... FOR UPDATE
        DocumentNumberSequence sequence = sequenceRepository
                .findByDocumentTypeAndYearForUpdate(type.name(), currentYear, tenantContext.getRequiredOrganizationId())
                .orElseGet(() -> {
                    log.info("Creation de la sequence {} pour l'annee {} [{}]", type.name(), currentYear, countryCode);
                    DocumentNumberSequence newSeq = new DocumentNumberSequence(type.name(), currentYear, prefix);
                    return sequenceRepository.save(newSeq);
                });

        // Incrementer le compteur
        int nextNumber = sequence.incrementAndGet();
        sequenceRepository.save(sequence);

        // Formater : PREFIX-YYYY-NNNNN
        String legalNumber = String.format("%s-%d-%05d", prefix, currentYear, nextNumber);

        log.info("Numero legal genere: {} (sequence #{} pour {} {} [{}])",
                legalNumber, nextNumber, type.name(), currentYear, countryCode);

        return legalNumber;
    }

    /**
     * Verifie si un type de document requiert une numerotation legale
     * selon la reglementation du pays de l'organisation.
     */
    public boolean requiresLegalNumber(DocumentType type) {
        String countryCode = tenantContext.getCountryCode();
        CountryComplianceStrategy strategy = strategyRegistry.get(countryCode);
        return strategy.requiresLegalNumber(type);
    }

    /**
     * Retourne le dernier numero genere pour un type et une annee (lecture seule).
     */
    @Transactional(readOnly = true)
    public int getLastNumber(DocumentType type, int year) {
        return sequenceRepository.findByDocumentTypeAndYear(type.name(), year)
                .map(DocumentNumberSequence::getLastNumber)
                .orElse(0);
    }

    /**
     * Resout le prefixe a utiliser pour la numerotation :
     * 1. FiscalProfile.invoicePrefix (si FACTURE et defini, sans le tiret final)
     * 2. Defaut du strategy par pays
     */
    private String resolvePrefix(DocumentType type, CountryComplianceStrategy strategy) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        if (type == DocumentType.FACTURE) {
            return fiscalProfileRepository.findByOrganizationId(orgId)
                .filter(fp -> fp.getInvoicePrefix() != null && !fp.getInvoicePrefix().isBlank())
                .map(fp -> {
                    // Nettoyer le prefixe : "FA-" -> "FA", "FAC" -> "FAC"
                    String raw = fp.getInvoicePrefix().trim();
                    if (raw.endsWith("-")) {
                        raw = raw.substring(0, raw.length() - 1);
                    }
                    return raw;
                })
                .orElse(strategy.getDefaultPrefix(type));
        }

        return strategy.getDefaultPrefix(type);
    }
}
