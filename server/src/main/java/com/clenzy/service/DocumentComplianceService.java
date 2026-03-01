package com.clenzy.service;

import com.clenzy.compliance.ComplianceStrategyRegistry;
import com.clenzy.compliance.CountryComplianceStrategy;
import com.clenzy.dto.ComplianceReportDto;
import com.clenzy.dto.ComplianceStatsDto;
import com.clenzy.exception.DocumentComplianceException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service de conformite reglementaire pour les documents generes.
 * <p>
 * Delegue la logique specifique au pays via {@link CountryComplianceStrategy}
 * resolu depuis {@link TenantContext#getCountryCode()}.
 * <p>
 * Responsabilites :
 * - Calcul et verification de hash SHA-256 (immutabilite)
 * - Verrouillage des documents comptables apres generation
 * - Validation de conformite des templates (mentions legales par pays)
 * - Resolution des tags de conformite a injecter dans les documents
 * - Gestion des documents correctifs (avoir)
 * - Statistiques de conformite
 */
@Service
public class DocumentComplianceService {

    private static final Logger log = LoggerFactory.getLogger(DocumentComplianceService.class);

    private final DocumentGenerationRepository generationRepository;
    private final DocumentLegalRequirementRepository legalRequirementRepository;
    private final TemplateComplianceReportRepository complianceReportRepository;
    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository templateTagRepository;
    private final DocumentStorageService storageService;
    private final AuditLogService auditLogService;
    private final ComplianceStrategyRegistry strategyRegistry;
    private final TenantContext tenantContext;

    public DocumentComplianceService(
            DocumentGenerationRepository generationRepository,
            DocumentLegalRequirementRepository legalRequirementRepository,
            TemplateComplianceReportRepository complianceReportRepository,
            DocumentTemplateRepository templateRepository,
            DocumentTemplateTagRepository templateTagRepository,
            DocumentStorageService storageService,
            AuditLogService auditLogService,
            ComplianceStrategyRegistry strategyRegistry,
            TenantContext tenantContext
    ) {
        this.generationRepository = generationRepository;
        this.legalRequirementRepository = legalRequirementRepository;
        this.complianceReportRepository = complianceReportRepository;
        this.templateRepository = templateRepository;
        this.templateTagRepository = templateTagRepository;
        this.storageService = storageService;
        this.auditLogService = auditLogService;
        this.strategyRegistry = strategyRegistry;
        this.tenantContext = tenantContext;
    }

    // ─── Hash et immutabilite ───────────────────────────────────────────────

    public String computeHash(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new DocumentComplianceException("SHA-256 non disponible", e);
        }
    }

    @Transactional
    public void lockDocument(DocumentGeneration generation, byte[] pdfBytes) {
        String hash = computeHash(pdfBytes);
        generation.setDocumentHash(hash);
        generation.setLocked(true);
        generation.setLockedAt(LocalDateTime.now());
        generationRepository.save(generation);

        auditLogService.logAction(AuditAction.DOCUMENT_LOCK, "DocumentGeneration",
                String.valueOf(generation.getId()), null, null,
                "Document verrouille: " + generation.getLegalNumber() + " (hash: " + hash.substring(0, 16) + "...)",
                AuditSource.WEB);

        log.info("Document verrouille: {} (hash: {}...)", generation.getLegalNumber(), hash.substring(0, 16));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyDocumentIntegrity(Long generationId) {
        DocumentGeneration generation = generationRepository.findById(generationId)
                .orElseThrow(() -> new DocumentNotFoundException("Generation introuvable: " + generationId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generationId", generationId);
        result.put("legalNumber", generation.getLegalNumber());
        result.put("locked", generation.isLocked());

        if (generation.getDocumentHash() == null || generation.getFilePath() == null) {
            result.put("verified", false);
            result.put("reason", "Document sans hash ou sans fichier");
            return result;
        }

        try {
            byte[] fileBytes = storageService.loadAsBytes(generation.getFilePath());
            String computedHash = computeHash(fileBytes);
            boolean verified = computedHash.equals(generation.getDocumentHash());

            result.put("verified", verified);
            result.put("storedHash", generation.getDocumentHash());
            result.put("computedHash", computedHash);

            auditLogService.logAction(AuditAction.DOCUMENT_VERIFY, "DocumentGeneration",
                    String.valueOf(generationId), null, null,
                    "Verification integrite: " + (verified ? "OK" : "ECHEC") + " pour " + generation.getLegalNumber(),
                    AuditSource.WEB);

            if (!verified) {
                log.warn("ALERTE INTEGRITE: Le hash du document {} ne correspond pas ! Stocke: {} Calcule: {}",
                        generationId, generation.getDocumentHash(), computedHash);
            }

            return result;
        } catch (Exception e) {
            result.put("verified", false);
            result.put("reason", "Erreur lecture fichier: " + e.getMessage());
            return result;
        }
    }

    // ─── Validation de conformite template ──────────────────────────────────

    @Transactional
    public ComplianceReportDto checkTemplateCompliance(Long templateId, String checkedBy) {
        if (checkedBy == null || checkedBy.isBlank()) {
            checkedBy = "system";
        }

        DocumentTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new DocumentNotFoundException("Template introuvable: " + templateId));

        DocumentType docType = template.getDocumentType();
        String countryCode = tenantContext.getCountryCode();
        CountryComplianceStrategy strategy = strategyRegistry.get(countryCode);

        List<DocumentTemplateTag> templateTags = templateTagRepository.findByTemplateId(templateId);
        Set<String> tagNames = templateTags.stream()
                .map(t -> t.getTagName().toLowerCase())
                .collect(Collectors.toSet());

        // Query par pays
        List<DocumentLegalRequirement> requirements = legalRequirementRepository
                .findByCountryCodeAndDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(countryCode, docType);

        List<String> missingTags = new ArrayList<>();
        List<String> missingMentions = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Delegation au strategy pour le mapping mentions → tags
        Map<String, List<String>> mentionToTags = strategy.buildMentionTagMapping();

        for (DocumentLegalRequirement req : requirements) {
            List<String> expectedTags = mentionToTags.getOrDefault(req.getRequirementKey(), Collections.emptyList());

            if (expectedTags.isEmpty()) {
                if (req.getDefaultValue() == null || req.getDefaultValue().isBlank()) {
                    warnings.add(req.getLabel() + " (pas de valeur par defaut)");
                }
                continue;
            }

            boolean hasAtLeastOne = expectedTags.stream().anyMatch(tagNames::contains);
            if (!hasAtLeastOne && req.isRequired()) {
                missingMentions.add(req.getLabel());
                missingTags.addAll(expectedTags);
            }
        }

        int totalRequired = (int) requirements.stream().filter(DocumentLegalRequirement::isRequired).count();
        int fulfilled = totalRequired - missingMentions.size();
        int score = totalRequired > 0 ? (fulfilled * 100) / totalRequired : 100;

        boolean compliant = missingMentions.isEmpty();

        TemplateComplianceReport report = new TemplateComplianceReport();
        report.setTemplate(template);
        report.setCompliant(compliant);
        report.setCheckedAt(LocalDateTime.now());
        report.setCheckedBy(checkedBy);
        report.setMissingTags(String.join(",", missingTags));
        report.setMissingMentions(String.join(",", missingMentions));
        report.setWarnings(String.join(",", warnings));
        report.setScore(score);
        complianceReportRepository.save(report);

        auditLogService.logAction(AuditAction.COMPLIANCE_CHECK, "DocumentTemplate",
                String.valueOf(templateId), null, null,
                "Verification conformite " + strategy.getStandardName() + ": "
                        + (compliant ? "CONFORME" : "NON CONFORME")
                        + " (score: " + score + "%) pour " + template.getName(),
                AuditSource.WEB);

        log.info("Conformite {} template {}: {} (score: {}%, {} mentions manquantes)",
                strategy.getStandardName(), template.getName(),
                compliant ? "CONFORME" : "NON CONFORME", score, missingMentions.size());

        return ComplianceReportDto.fromEntity(report, template.getName(), docType.name());
    }

    // ─── Tags de conformite ──────────────────────────────────────────────────

    /**
     * Resout les tags de conformite reglementaire a injecter dans le document.
     * Delegue au {@link CountryComplianceStrategy} du pays de l'organisation,
     * puis enrichit avec les valeurs par defaut de la BDD.
     */
    public Map<String, Object> resolveComplianceTags(DocumentType type, String legalNumber) {
        String countryCode = tenantContext.getCountryCode();
        CountryComplianceStrategy strategy = strategyRegistry.get(countryCode);

        // Tags specifiques au pays (conditions paiement, validite devis, etc.)
        Map<String, Object> tags = strategy.resolveComplianceTags(type, legalNumber);

        // Date d'emission au format du pays
        DateTimeFormatter dateFormat = DateTimeFormatter.ofPattern(strategy.getDateFormatPattern());
        tags.put("date_emission", LocalDateTime.now().format(dateFormat));

        // Enrichir avec les valeurs par defaut de la BDD pour ce pays
        List<DocumentLegalRequirement> requirements = legalRequirementRepository
                .findByCountryCodeAndDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(countryCode, type);

        List<String> mentions = new ArrayList<>();
        for (DocumentLegalRequirement req : requirements) {
            if (req.getDefaultValue() != null && !req.getDefaultValue().isBlank()) {
                tags.putIfAbsent(req.getRequirementKey(), req.getDefaultValue());
                mentions.add(req.getLabel());
            }
        }
        tags.put("mentions", mentions);
        tags.put("compliance_standard", strategy.getStandardName());

        return tags;
    }

    /**
     * @deprecated Utiliser {@link #resolveComplianceTags(DocumentType, String)} a la place.
     *             Conserve pour compatibilite avec les appelants existants.
     */
    @Deprecated
    public Map<String, Object> resolveNfTags(DocumentType type, String legalNumber) {
        return resolveComplianceTags(type, legalNumber);
    }

    // ─── Documents correctifs ───────────────────────────────────────────────

    @Transactional
    public void markAsCorrection(Long newGenerationId, Long originalGenerationId) {
        DocumentGeneration newGen = generationRepository.findById(newGenerationId)
                .orElseThrow(() -> new DocumentNotFoundException("Generation introuvable: " + newGenerationId));
        DocumentGeneration originalGen = generationRepository.findById(originalGenerationId)
                .orElseThrow(() -> new DocumentNotFoundException("Generation originale introuvable: " + originalGenerationId));

        if (!originalGen.isLocked()) {
            throw new DocumentComplianceException("Le document original n'est pas verrouille");
        }

        newGen.setCorrectsId(originalGenerationId);
        generationRepository.save(newGen);

        auditLogService.logAction(AuditAction.DOCUMENT_CORRECT, "DocumentGeneration",
                String.valueOf(newGenerationId), null, null,
                "Document correctif pour #" + originalGenerationId
                        + " (" + originalGen.getLegalNumber() + ")",
                AuditSource.WEB);

        log.info("Document #{} marque comme correction de #{} ({})",
                newGenerationId, originalGenerationId, originalGen.getLegalNumber());
    }

    // ─── Statistiques ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ComplianceStatsDto getComplianceStats() {
        String countryCode = tenantContext.getCountryCode();
        CountryComplianceStrategy strategy = strategyRegistry.get(countryCode);

        long totalDocuments = generationRepository.count();
        long totalLocked = generationRepository.countByLockedTrue();

        long totalFactures = generationRepository.countByDocumentType(DocumentType.FACTURE);
        long totalFacturesLocked = generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.FACTURE);

        long totalDevis = generationRepository.countByDocumentType(DocumentType.DEVIS);
        long totalDevisLocked = generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.DEVIS);

        Map<String, Long> documentsByType = new LinkedHashMap<>();
        for (DocumentType type : DocumentType.values()) {
            long count = generationRepository.countByDocumentType(type);
            if (count > 0) {
                documentsByType.put(type.name(), count);
            }
        }

        LocalDateTime lastCheckAt = complianceReportRepository.findMaxCheckedAt().orElse(null);
        int avgScore = complianceReportRepository.findAverageScore();

        return new ComplianceStatsDto(
                totalDocuments, totalLocked,
                totalFactures, totalFacturesLocked,
                totalDevis, totalDevisLocked,
                documentsByType, lastCheckAt, avgScore,
                countryCode, strategy.getStandardName()
        );
    }

    @Transactional(readOnly = true)
    public Optional<ComplianceReportDto> getLastComplianceReport(Long templateId) {
        DocumentTemplate template = templateRepository.findById(templateId).orElse(null);
        if (template == null) return Optional.empty();

        return complianceReportRepository.findTopByTemplateOrderByCheckedAtDesc(template)
                .map(report -> ComplianceReportDto.fromEntity(report, template.getName(), template.getDocumentType().name()));
    }
}
