package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Service principal de generation de documents — orchestrateur mince.
 * <p>
 * Les responsabilites sont reparties entre collaborateurs dedies :
 * <ul>
 *   <li>{@link DocumentTemplateManager} — cycle de vie des templates (CRUD,
 *       remplacement de fichier, re-parsing des tags)</li>
 *   <li>{@link DocumentPreviewService} — previsualisation PDF (chargement de
 *       contexte par type de reference, placeholders)</li>
 *   <li>{@link DocumentGenerationPipeline} — pipeline complet de generation
 *       (numerotation legale NF, resolution des tags, rendu, conversion PDF,
 *       stockage, verrouillage, Invoice, notifications, audit, metriques)</li>
 *   <li>{@link DocumentEmailDispatcher} — envoi email + dedup d'envoi</li>
 *   <li>{@link DocumentTemplateRenderer} — contenu du template, remplissage
 *       Freemarker/XDocReport, validation des tags</li>
 * </ul>
 * Pipeline complet :
 * 1. Trouver le template actif pour le type de document
 * 2. Creer un enregistrement DocumentGeneration (statut PENDING)
 * 2.5 [NF] Generer le numero legal sequentiel (FACTURE/DEVIS)
 * 3. Charger le fichier .odt du template
 * 3.5 [NF] Injecter les tags NF (numero legal, mentions legales)
 * 4. Resoudre les tags (TagResolverService)
 * 5. Remplir le template via XDocReport
 * 6. Convertir en PDF via LibreOffice
 * 7. Stocker le PDF (DocumentStorageService)
 * 8. Mettre a jour l'enregistrement (statut COMPLETED)
 * 8.5 [NF] Verrouiller le document (hash SHA-256, locked=true)
 * 9. Envoyer la notification + audit
 * 10. Envoyer par email si demande
 */
@Service
public class DocumentGeneratorService {

    private final DocumentTemplateManager templateManager;
    private final DocumentPreviewService previewService;
    private final DocumentGenerationPipeline generationPipeline;
    private final DocumentEmailDispatcher emailDispatcher;
    private final DocumentTemplateRepository templateRepository;
    private final DocumentGenerationRepository generationRepository;
    private final TaxRulePreValidator taxRulePreValidator;
    private final TenantContext tenantContext;
    private final FiscalProfileRepository fiscalProfileRepository;

    public DocumentGeneratorService(
            DocumentTemplateManager templateManager,
            DocumentPreviewService previewService,
            DocumentGenerationPipeline generationPipeline,
            DocumentEmailDispatcher emailDispatcher,
            DocumentTemplateRepository templateRepository,
            DocumentGenerationRepository generationRepository,
            TaxRulePreValidator taxRulePreValidator,
            TenantContext tenantContext,
            FiscalProfileRepository fiscalProfileRepository
    ) {
        this.templateManager = templateManager;
        this.previewService = previewService;
        this.generationPipeline = generationPipeline;
        this.emailDispatcher = emailDispatcher;
        this.templateRepository = templateRepository;
        this.generationRepository = generationRepository;
        this.taxRulePreValidator = taxRulePreValidator;
        this.tenantContext = tenantContext;
        this.fiscalProfileRepository = fiscalProfileRepository;
    }

    // ─── Templates CRUD ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentTemplate> listTemplates() {
        return templateManager.listTemplates();
    }

    @Transactional(readOnly = true)
    public DocumentTemplate getTemplate(Long id) {
        return templateManager.getTemplate(id);
    }

    @Transactional
    public DocumentTemplate uploadTemplate(MultipartFile file, String name, String description,
                                            String documentTypeStr, String eventTrigger,
                                            String emailSubject, String emailBody, Jwt jwt) {
        return templateManager.uploadTemplate(file, name, description, documentTypeStr,
                eventTrigger, emailSubject, emailBody, extractEmail(jwt));
    }

    @Transactional
    public DocumentTemplate updateTemplate(Long id, String name, String description,
                                            String eventTrigger, String emailSubject, String emailBody) {
        return templateManager.updateTemplate(id, name, description, eventTrigger, emailSubject, emailBody);
    }

    @Transactional
    public DocumentTemplate activateTemplate(Long id) {
        return templateManager.activateTemplate(id);
    }

    @Transactional
    public void deleteTemplate(Long id) {
        templateManager.deleteTemplate(id);
    }

    /**
     * Remplace le fichier source d'un template existant par un nouveau .odt,
     * sans changer son ID ni ses metadata. Voir {@link DocumentTemplateManager}.
     */
    @Transactional
    public DocumentTemplate replaceTemplateFile(Long id, MultipartFile file) {
        return templateManager.replaceTemplateFile(id, file);
    }

    @Transactional
    public DocumentTemplate reparseTemplate(Long id) {
        return templateManager.reparseTemplate(id);
    }

    // ─── Download / Preview ─────────────────────────────────────────────────

    /**
     * Retourne le contenu binaire du fichier source du template (.odt).
     */
    @Transactional(readOnly = true)
    public byte[] getTemplateOriginalContent(Long id) {
        return templateManager.getTemplateOriginalContent(id);
    }

    /**
     * Genere un PDF de previsualisation d'un template. Aucune persistance,
     * pas d'email, pas de numerotation legale reelle.
     * Voir {@link DocumentPreviewService#generatePreview}.
     */
    @Transactional(readOnly = true)
    public byte[] generateTemplatePreview(Long id) {
        DocumentTemplate template = templateManager.getTemplate(id);
        return previewService.generatePreview(template);
    }

    // ─── Generation de documents ────────────────────────────────────────────

    @Transactional
    public DocumentGenerationDto generateDocument(GenerateDocumentRequest request, Jwt jwt) {
        DocumentType documentType = parseDocumentType(request.documentType());
        ReferenceType referenceType = parseReferenceType(request.referenceType());

        // Pre-valider les regles fiscales avant de creer un DocumentGeneration
        if (documentType == DocumentType.FACTURE) {
            taxRulePreValidator.validateTaxRulesExist(
                    tenantContext.getCountryCode(), java.time.LocalDate.now());
        }

        DocumentTemplate template = templateRepository.findByDocumentTypeAndActiveTrue(documentType)
                .orElseThrow(() -> new DocumentNotFoundException(
                        "Aucun template actif pour le type: " + documentType.getLabel()));

        return generationPipeline.execute(new DocumentGenerationPipeline.GenerationCommand(
                template, request.referenceId(), referenceType,
                request.emailTo(), request.sendEmail(),
                jwt != null ? jwt.getSubject() : "system", extractEmail(jwt),
                null, null, request.forceResend(),
                request.emailSubject(), request.emailBody()));
    }

    /**
     * Generation depuis un evenement Kafka (contexte async, pas de HTTP request).
     * L'organizationId est transmis dans le payload Kafka car TenantContext
     * (request-scoped) n'est pas disponible dans le consumer Kafka.
     */
    @Transactional
    public DocumentGenerationDto generateFromEvent(DocumentType documentType, Long referenceId,
                                                     ReferenceType referenceType, String emailTo,
                                                     Long organizationId) {
        // Resoudre le countryCode depuis FiscalProfile (TenantContext indisponible en Kafka)
        String countryCode = resolveCountryCode(organizationId);

        // Pre-valider les regles fiscales avant de creer un DocumentGeneration
        if (documentType == DocumentType.FACTURE) {
            taxRulePreValidator.validateTaxRulesExist(countryCode, java.time.LocalDate.now());
        }

        DocumentTemplate template = templateRepository.findByDocumentTypeAndActiveTrue(documentType)
                .orElse(null);

        if (template == null) {
            // Mode A : aucun template actif — ligne FAILED explicite persistee via
            // le recorder REQUIRES_NEW (voir DocumentGenerationPipeline).
            generationPipeline.recordMissingTemplateFailure(
                    documentType, referenceId, referenceType, organizationId, emailTo);
            return null;
        }

        // forceResend=false : la dedup s'applique (un devis envoye auto a la
        // soumission ne doit pas etre renvoye par un clic "Generer PDF" ulterieur).
        // Pas d'override d'email a la soumission (contenu = template par defaut).
        return generationPipeline.execute(new DocumentGenerationPipeline.GenerationCommand(
                template, referenceId, referenceType,
                emailTo, emailTo != null && !emailTo.isBlank(),
                "system", "system",
                organizationId, countryCode, false, null, null));
    }

    /**
     * Garde d'idempotence : ce document a-t-il deja ete envoye par email a ce
     * destinataire pour cette reference ? {@code forceResend=true} court-circuite
     * (bouton "Renvoyer" → toujours false). Delegation conservee en package-private
     * pour les tests unitaires existants.
     */
    boolean isEmailAlreadySent(boolean forceResend, ReferenceType referenceType,
                               Long referenceId, DocumentType documentType, String emailTo) {
        return emailDispatcher.isEmailAlreadySent(forceResend, referenceType, referenceId,
                documentType, emailTo);
    }

    /**
     * Contenu par defaut (objet + corps plain text) du mail devis prospect, pour
     * preremplir l'editeur "Renvoyer" cote frontend.
     */
    public Map<String, String> getQuoteEmailDefaults() {
        return emailDispatcher.getQuoteEmailDefaults();
    }

    // ─── Generations par reference ──────────────────────────────────────────

    /**
     * Retourne les generations de documents pour un type de reference et un ID donnes.
     */
    @Transactional(readOnly = true)
    public List<DocumentGenerationDto> getGenerationsByReference(ReferenceType referenceType, Long referenceId) {
        // Audit 2026-07 F1-09 : scoper à l'organisation courante (filtre Hibernate inerte en
        // HTTP) pour tout rôle non platform-staff — ferme la fuite cross-tenant (dont SUPERVISOR)
        // sur les refType != INTERVENTION. Le staff plateforme conserve la vue cross-org.
        final Long orgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        return generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(referenceType, referenceId)
                .stream()
                .filter(g -> orgId == null || orgId.equals(g.getOrganizationId()))
                .map(DocumentGenerationDto::fromEntity)
                .toList();
    }

    // ─── Historique ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<DocumentGenerationDto> listGenerations(Pageable pageable) {
        // Audit 2026-07 F1-02 : scoper l'historique à l'organisation courante (le filtre
        // Hibernate organizationFilter est inerte sur les flux HTTP). Le staff plateforme
        // (SUPER_ADMIN/SUPER_MANAGER) conserve la vue cross-org.
        Page<com.clenzy.model.DocumentGeneration> page = tenantContext.isSuperAdmin()
                ? generationRepository.findAllByOrderByCreatedAtDesc(pageable)
                : generationRepository.findByOrganizationIdOrderByCreatedAtDesc(
                        tenantContext.getRequiredOrganizationId(), pageable);
        return page.map(DocumentGenerationDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public DocumentGeneration getGeneration(Long id) {
        return generationRepository.findById(id)
                .orElseThrow(() -> new DocumentNotFoundException("Generation introuvable: " + id));
    }

    @Transactional(readOnly = true)
    public DocumentGeneration getGenerationByLegalNumber(String legalNumber) {
        return generationRepository.findByLegalNumber(legalNumber)
                .orElseThrow(() -> new DocumentNotFoundException("Document introuvable avec le numero: " + legalNumber));
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private String extractEmail(Jwt jwt) {
        if (jwt == null) return "system";
        String email = jwt.getClaimAsString("email");
        return email != null ? email : jwt.getSubject();
    }

    private DocumentType parseDocumentType(String value) {
        try {
            return DocumentType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new DocumentValidationException("Type de document inconnu: " + value);
        }
    }

    private ReferenceType parseReferenceType(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ReferenceType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new DocumentValidationException("Type de reference inconnu: " + value);
        }
    }

    /**
     * Resout le countryCode depuis le FiscalProfile de l'organisation.
     * Utilise en contexte Kafka ou TenantContext n'est pas disponible.
     * Fallback : "FR" (defaut historique).
     */
    private String resolveCountryCode(Long organizationId) {
        if (organizationId == null) return "FR";
        return fiscalProfileRepository.findByOrganizationId(organizationId)
                .map(fp -> fp.getCountryCode() != null ? fp.getCountryCode() : "FR")
                .orElse("FR");
    }

    /**
     * Delegations conservees vers les implementations du pipeline : l'API privee
     * historique de cette classe est exercee par des tests de caracterisation
     * (reflection). L'implementation vit dans {@link DocumentGenerationPipeline}.
     */
    @SuppressWarnings("unused")
    private String buildPdfFilename(DocumentType type, Long referenceId) {
        return DocumentGenerationPipeline.buildPdfFilename(type, referenceId);
    }

    @SuppressWarnings("unused")
    private String formatFileSize(long bytes) {
        return DocumentGenerationPipeline.formatFileSize(bytes);
    }
}
