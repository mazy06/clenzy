package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.*;
import com.clenzy.tenant.TenantContext;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.repository.FiscalProfileRepository;
import fr.opensagres.xdocreport.document.IXDocReport;
import fr.opensagres.xdocreport.document.registry.XDocReportRegistry;
import fr.opensagres.xdocreport.template.IContext;
import fr.opensagres.xdocreport.template.TemplateEngineKind;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service principal de generation de documents.
 * <p>
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

    private static final Logger log = LoggerFactory.getLogger(DocumentGeneratorService.class);

    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository tagRepository;
    private final DocumentGenerationRepository generationRepository;
    private final DocumentTemplateStorageService templateStorageService;
    private final DocumentStorageService documentStorageService;
    private final TemplateParserService templateParserService;
    private final TagResolverService tagResolverService;
    private final LibreOfficeConversionService conversionService;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final DocumentNumberingService numberingService;
    private final DocumentComplianceService complianceService;
    private final InvoiceGeneratorService invoiceGeneratorService;
    private final TaxRulePreValidator taxRulePreValidator;
    private final TenantContext tenantContext;
    private final FiscalProfileRepository fiscalProfileRepository;

    private final Counter generationSuccessCounter;
    private final Counter generationFailureCounter;
    private final Timer generationTimer;

    public DocumentGeneratorService(
            DocumentTemplateRepository templateRepository,
            DocumentTemplateTagRepository tagRepository,
            DocumentGenerationRepository generationRepository,
            DocumentTemplateStorageService templateStorageService,
            DocumentStorageService documentStorageService,
            TemplateParserService templateParserService,
            TagResolverService tagResolverService,
            LibreOfficeConversionService conversionService,
            EmailService emailService,
            NotificationService notificationService,
            AuditLogService auditLogService,
            KafkaTemplate<String, Object> kafkaTemplate,
            DocumentNumberingService numberingService,
            DocumentComplianceService complianceService,
            InvoiceGeneratorService invoiceGeneratorService,
            TaxRulePreValidator taxRulePreValidator,
            TenantContext tenantContext,
            FiscalProfileRepository fiscalProfileRepository,
            MeterRegistry meterRegistry
    ) {
        this.templateRepository = templateRepository;
        this.tagRepository = tagRepository;
        this.generationRepository = generationRepository;
        this.templateStorageService = templateStorageService;
        this.documentStorageService = documentStorageService;
        this.templateParserService = templateParserService;
        this.tagResolverService = tagResolverService;
        this.conversionService = conversionService;
        this.emailService = emailService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.kafkaTemplate = kafkaTemplate;
        this.numberingService = numberingService;
        this.complianceService = complianceService;
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.taxRulePreValidator = taxRulePreValidator;
        this.tenantContext = tenantContext;
        this.fiscalProfileRepository = fiscalProfileRepository;

        this.generationSuccessCounter = Counter.builder("clenzy.documents.generation.success")
                .description("Nombre de documents generes avec succes")
                .register(meterRegistry);
        this.generationFailureCounter = Counter.builder("clenzy.documents.generation.failure")
                .description("Nombre d'echecs de generation")
                .register(meterRegistry);
        this.generationTimer = Timer.builder("clenzy.documents.generation.duration")
                .description("Duree de generation des documents")
                .register(meterRegistry);
    }

    // ─── Templates CRUD ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentTemplate> listTemplates() {
        return templateRepository.findAllByOrderByDocumentTypeAscVersionDesc();
    }

    @Transactional(readOnly = true)
    public DocumentTemplate getTemplate(Long id) {
        return templateRepository.findByIdWithTags(id)
                .orElseThrow(() -> new DocumentNotFoundException("Template introuvable: " + id));
    }

    @Transactional
    public DocumentTemplate uploadTemplate(MultipartFile file, String name, String description,
                                            String documentTypeStr, String eventTrigger,
                                            String emailSubject, String emailBody, Jwt jwt) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".odt")) {
            throw new DocumentValidationException("Seuls les fichiers .odt sont acceptes");
        }

        // Validate filename to prevent path traversal
        if (originalFilename.contains("..") || originalFilename.contains("/") || originalFilename.contains("\\")) {
            throw new DocumentValidationException("Nom de fichier invalide");
        }

        DocumentType documentType = parseDocumentType(documentTypeStr);

        byte[] fileContent;
        try {
            fileContent = file.getBytes();
        } catch (java.io.IOException e) {
            throw new DocumentStorageException("Failed to read uploaded file", e);
        }

        DocumentTemplate template = new DocumentTemplate();
        template.setName(name);
        template.setDescription(description);
        template.setDocumentType(documentType);
        template.setEventTrigger(eventTrigger);
        template.setFileContent(fileContent);
        template.setOriginalFilename(originalFilename);
        template.setEmailSubject(emailSubject);
        template.setEmailBody(emailBody);
        template.setCreatedBy(extractEmail(jwt));
        template.setActive(false);
        template.setOrganizationId(tenantContext.getOrganizationId());

        template = templateRepository.save(template);

        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(fileContent);
        for (DocumentTemplateTag tag : tags) {
            tag.setTemplate(template);
        }
        tagRepository.saveAll(tags);
        template.setTags(tags);

        notificationService.notifyAdminsAndManagers(
                NotificationKey.DOCUMENT_TEMPLATE_UPLOADED,
                "Template uploade : " + name,
                "Le template \"" + name + "\" (" + documentType.getLabel() + ") a ete uploade avec "
                        + tags.size() + " tags detectes.",
                "/documents/templates/" + template.getId()
        );

        auditLogService.logCreate("DocumentTemplate", String.valueOf(template.getId()),
                "Upload template: " + name + " (" + documentType + ")");

        log.info("Template uploaded: {} (id={}, {} tags)", name, template.getId(), tags.size());
        return template;
    }

    @Transactional
    public DocumentTemplate updateTemplate(Long id, String name, String description,
                                            String eventTrigger, String emailSubject, String emailBody) {
        DocumentTemplate template = getTemplate(id);
        if (name != null && !name.isBlank()) template.setName(name);
        if (description != null) template.setDescription(description);
        if (eventTrigger != null) template.setEventTrigger(eventTrigger);
        if (emailSubject != null) template.setEmailSubject(emailSubject);
        if (emailBody != null) template.setEmailBody(emailBody);

        return templateRepository.save(template);
    }

    @Transactional
    public DocumentTemplate activateTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        templateRepository.deactivateAllByTypeExcept(template.getDocumentType(), id, tenantContext.getRequiredOrganizationId());
        template.setActive(true);
        return templateRepository.save(template);
    }

    @Transactional
    public void deleteTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        tagRepository.deleteByTemplateId(id);
        // Nettoyage legacy : supprimer le fichier sur disque si present
        if (template.getFilePath() != null && !template.getFilePath().isBlank()) {
            templateStorageService.delete(template.getFilePath());
        }
        templateRepository.delete(template);

        auditLogService.logDelete("DocumentTemplate", String.valueOf(id),
                "Delete template: " + template.getName());
        log.info("Template deleted: {} (id={})", template.getName(), id);
    }

    @Transactional
    public DocumentTemplate reparseTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        tagRepository.deleteByTemplateId(id);

        byte[] content = resolveTemplateContent(template);
        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(content);
        for (DocumentTemplateTag tag : tags) {
            tag.setTemplate(template);
        }
        tagRepository.saveAll(tags);
        template.setTags(tags);

        log.info("Template re-parsed: {} ({} tags)", template.getName(), tags.size());
        return template;
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

        return executeGeneration(template, request.referenceId(), referenceType,
                request.emailTo(), request.sendEmail(), jwt, null, null);
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
            log.warn("No active template for type {}, skipping generation", documentType);
            return null;
        }

        return executeGeneration(template, referenceId, referenceType,
                emailTo, emailTo != null && !emailTo.isBlank(), null, organizationId, countryCode);
    }

    /**
     * Pipeline complet de generation.
     * @param explicitOrgId organizationId transmis par le Kafka event (non-null en contexte async).
     *                      Si null, on utilise le TenantContext (contexte HTTP).
     * @param explicitCountryCode countryCode resolu depuis FiscalProfile en contexte Kafka.
     *                            Si null, on utilise le TenantContext (contexte HTTP).
     */
    private DocumentGenerationDto executeGeneration(DocumentTemplate template, Long referenceId,
                                                     ReferenceType referenceType, String emailTo,
                                                     boolean sendEmail, Jwt jwt, Long explicitOrgId,
                                                     String explicitCountryCode) {
        long startTime = System.currentTimeMillis();

        // Resoudre l'organizationId : explicite (Kafka) ou via TenantContext (HTTP)
        final Long orgId = explicitOrgId != null ? explicitOrgId : tenantContext.getOrganizationId();
        final String countryCode = explicitCountryCode != null ? explicitCountryCode : tenantContext.getCountryCode();

        // 1. Creer l'enregistrement via Builder
        DocumentGeneration generation = DocumentGeneration.builder()
                .template(template)
                .documentType(template.getDocumentType())
                .referenceId(referenceId)
                .referenceType(referenceType)
                .userId(jwt != null ? jwt.getSubject() : "system")
                .userEmail(jwt != null ? extractEmail(jwt) : "system")
                .status(DocumentGenerationStatus.GENERATING)
                .emailTo(emailTo)
                .build();
        generation.setOrganizationId(orgId);
        generation = generationRepository.save(generation);

        try {
            // 2.5 [NF] Generer le numero legal sequentiel (FACTURE/DEVIS)
            String legalNumber = null;
            if (numberingService.requiresLegalNumber(template.getDocumentType(), countryCode)) {
                legalNumber = numberingService.generateNextNumber(template.getDocumentType(), countryCode, orgId);
                generation.setLegalNumber(legalNumber);
                generationRepository.save(generation);
                log.info("Numero legal attribue: {} pour generation #{}", legalNumber, generation.getId());
            }

            // 2. Charger le template .odt
            byte[] templateContent = resolveTemplateContent(template);

            // 3. Resoudre les tags
            Map<String, Object> context = tagResolverService.resolveTagsForDocument(
                    template.getDocumentType(), referenceId,
                    referenceType != null ? referenceType.name() : null);

            // 3.5 Injecter les tags de conformite reglementaire (numero legal, mentions legales)
            if (legalNumber != null) {
                Map<String, Object> nfTags = complianceService.resolveComplianceTags(
                        template.getDocumentType(), legalNumber);
                // Namespace "nf" conserve pour compatibilite avec les templates existants
                context.put("nf", nfTags);
            }

            // 3.9 Garantir que tous les tags du template ont un fallback vide
            ensureTemplateTagsPresent(template, context);

            // 4. Remplir le template via XDocReport
            byte[] filledOdt = fillTemplate(templateContent, context);

            // 5. Convertir en PDF via LibreOffice
            byte[] pdfBytes = conversionService.convertToPdf(filledOdt, template.getOriginalFilename());

            // 6. Construire le nom du fichier
            String pdfFilename = buildPdfFilename(template.getDocumentType(), referenceId);

            // 7. Stocker le PDF
            String storagePath = documentStorageService.store(
                    template.getDocumentType().name(), pdfFilename, pdfBytes);

            // 8. Mettre a jour l'enregistrement
            int generationTimeMs = (int) (System.currentTimeMillis() - startTime);
            generation.setFilePath(storagePath);
            generation.setFileName(pdfFilename);
            generation.setFileSize((long) pdfBytes.length);
            generation.setStatus(DocumentGenerationStatus.COMPLETED);
            generation.setGenerationTimeMs(generationTimeMs);

            // 8.5 [NF] Verrouiller le document (hash SHA-256) pour FACTURE/DEVIS
            if (numberingService.requiresLegalNumber(template.getDocumentType(), countryCode)) {
                complianceService.lockDocument(generation, pdfBytes);
            }

            // 8.7 Creer l'Invoice correspondante (visible dans l'onglet Facturation)
            if (template.getDocumentType() == DocumentType.FACTURE
                    && referenceType != null && legalNumber != null) {
                createInvoiceForFacture(referenceType, referenceId, legalNumber, generation.getId(), orgId);
            }

            // 9. Envoyer par email si demande
            if (sendEmail && emailTo != null && !emailTo.isBlank()) {
                try {
                    sendDocumentByEmail(template, emailTo, pdfFilename, pdfBytes);
                    generation.setEmailStatus("SENT");
                    generation.setEmailSentAt(LocalDateTime.now());
                    generation.setStatus(DocumentGenerationStatus.SENT);

                    notificationService.notifyAdminsAndManagers(
                            NotificationKey.DOCUMENT_SENT_BY_EMAIL,
                            "Document envoye par email",
                            template.getDocumentType().getLabel() + " envoye a " + emailTo,
                            "/documents",
                            orgId
                    );
                } catch (Exception emailEx) {
                    log.error("Failed to send document email: {}", emailEx.getMessage());
                    generation.setEmailStatus("FAILED");
                }
            }

            generation = generationRepository.save(generation);

            // 10. Notification + Audit + Metrics
            //     tab=3 = onglet 'Historique' de la page Documents
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATED,
                    "Document genere : " + template.getDocumentType().getLabel(),
                    pdfFilename + " (" + formatFileSize(pdfBytes.length) + ") genere en " + generationTimeMs + "ms",
                    "/documents?tab=3",
                    orgId
            );

            auditLogService.logAction(AuditAction.DOCUMENT_GENERATE, "DocumentGeneration",
                    String.valueOf(generation.getId()), null, null,
                    "Generated: " + pdfFilename + " (" + generationTimeMs + "ms)",
                    AuditSource.WEB, orgId);

            generationSuccessCounter.increment();
            generationTimer.record(java.time.Duration.ofMillis(generationTimeMs));

            log.info("Document generated: {} (id={}, {}ms, {} bytes)",
                    pdfFilename, generation.getId(), generationTimeMs, pdfBytes.length);

            return DocumentGenerationDto.fromEntity(generation);

        } catch (DocumentValidationException e) {
            log.warn("Document generation invalid request: {}", e.getMessage());
            handleGenerationFailure(generation, template, startTime, e, orgId);
            throw e;
        } catch (DocumentNotFoundException e) {
            log.warn("Document generation missing data: {}", e.getMessage());
            handleGenerationFailure(generation, template, startTime, e, orgId);
            throw e;
        } catch (DocumentStorageException e) {
            log.error("Document generation storage error: {}", e.getMessage(), e);
            handleGenerationFailure(generation, template, startTime, e, orgId);
            throw new DocumentGenerationException("Erreur de stockage lors de la generation: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Document generation failed: {}", e.getMessage(), e);
            handleGenerationFailure(generation, template, startTime, e, orgId);
            throw new DocumentGenerationException("Generation du document echouee: " + e.getMessage(), e);
        }
    }

    private void handleGenerationFailure(DocumentGeneration generation, DocumentTemplate template,
                                           long startTime, Exception e, Long orgId) {
        generation.setStatus(DocumentGenerationStatus.FAILED);
        generation.setErrorMessage(e.getMessage());
        generation.setGenerationTimeMs((int) (System.currentTimeMillis() - startTime));
        generationRepository.save(generation);

        notificationService.notifyAdminsAndManagers(
                NotificationKey.DOCUMENT_GENERATION_FAILED,
                "Echec generation document",
                template.getDocumentType().getLabel() + " : " + e.getMessage(),
                "/documents",
                orgId
        );

        generationFailureCounter.increment();
    }

    /**
     * Resout le contenu binaire d'un template (DB-first, fallback filesystem pour legacy).
     */
    private byte[] resolveTemplateContent(DocumentTemplate template) {
        if (template.getFileContent() != null) {
            return template.getFileContent();
        }
        if (template.getFilePath() != null && !template.getFilePath().isBlank()) {
            return templateStorageService.loadAsBytes(template.getFilePath());
        }
        throw new DocumentStorageException("No content for template: " + template.getId());
    }

    /**
     * Valide que tous les tags references dans le template sont presents dans le contexte.
     * Si des tags sont manquants, leve une erreur explicite avec la liste des tags absents
     * pour permettre de corriger le template ou le code de resolution.
     */
    @SuppressWarnings("unchecked")
    private void ensureTemplateTagsPresent(DocumentTemplate template, Map<String, Object> context) {
        List<DocumentTemplateTag> tags = template.getTags();
        if (tags == null || tags.isEmpty()) return;

        List<String> missingTags = new ArrayList<>();

        for (DocumentTemplateTag tag : tags) {
            String tagName = tag.getTagName();
            if (tagName == null || !tagName.contains(".")) continue;

            int dotIndex = tagName.indexOf('.');
            String group = tagName.substring(0, dotIndex);
            String field = tagName.substring(dotIndex + 1);

            Object groupObj = context.get(group);
            if (groupObj == null) {
                missingTags.add("${" + tagName + "} (groupe '" + group + "' absent)");
            } else if (groupObj instanceof Map) {
                Map<String, Object> groupMap = (Map<String, Object>) groupObj;
                if (!groupMap.containsKey(field)) {
                    missingTags.add("${" + tagName + "} (champ '" + field + "' absent du groupe '" + group + "')");
                }
            }
        }

        if (!missingTags.isEmpty()) {
            String availableGroups = context.keySet().stream()
                    .sorted()
                    .collect(Collectors.joining(", "));
            throw new DocumentGenerationException(
                    "Le template '" + template.getName() + "' contient " + missingTags.size()
                    + " tag(s) non resolus. Tags manquants : " + String.join(" | ", missingTags)
                    + ". Groupes disponibles dans le contexte : [" + availableGroups + "]"
                    + ". Corrigez le template ou ajoutez la resolution de ces tags dans TagResolverService/ComplianceService.");
        }
    }

    private byte[] fillTemplate(byte[] templateContent, Map<String, Object> contextMap) throws Exception {
        try (InputStream is = new ByteArrayInputStream(templateContent)) {
            IXDocReport report = XDocReportRegistry.getRegistry().loadReport(
                    is, TemplateEngineKind.Freemarker);

            IContext context = report.createContext();

            // Sanitize string values to prevent Freemarker template injection
            for (Map.Entry<String, Object> entry : contextMap.entrySet()) {
                if (entry.getValue() instanceof String strVal) {
                    // Block Freemarker directives in user-provided values
                    if (strVal.contains("<#") || strVal.contains("${") || strVal.contains("<@")) {
                        log.warn("Potential template injection detected in tag '{}', sanitizing", entry.getKey());
                        entry.setValue(strVal.replace("<#", "&lt;#").replace("${", "&#36;{").replace("<@", "&lt;@"));
                    }
                }
            }

            for (Map.Entry<String, Object> entry : contextMap.entrySet()) {
                context.put(entry.getKey(), entry.getValue());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            report.process(context, out);
            return out.toByteArray();
        }
    }

    private void sendDocumentByEmail(DocumentTemplate template, String toEmail,
                                      String pdfFilename, byte[] pdfBytes) {
        String subject = template.getEmailSubject() != null && !template.getEmailSubject().isBlank()
                ? template.getEmailSubject()
                : "Votre document Clenzy — " + template.getDocumentType().getLabel();

        String body = template.getEmailBody() != null && !template.getEmailBody().isBlank()
                ? template.getEmailBody()
                : buildDefaultEmailBody(template.getDocumentType());

        emailService.sendDocumentEmail(toEmail, subject, body, pdfFilename, pdfBytes);
    }

    private String buildDefaultEmailBody(DocumentType type) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:680px;margin:0 auto;'>"
                + "<h2 style='color:#0f172a;'>Votre document Clenzy</h2>"
                + "<p>Bonjour,</p>"
                + "<p>Veuillez trouver ci-joint votre document : <strong>" + type.getLabel() + "</strong>.</p>"
                + "<p>Ce document a ete genere automatiquement par le systeme Clenzy.</p>"
                + "<p style='color:#64748b;font-size:13px;margin-top:24px;'>Cordialement,<br>L'equipe Clenzy</p>"
                + "</div></body></html>";
    }

    private String buildPdfFilename(DocumentType type, Long referenceId) {
        String typeName = type.getLabel().replace(" ", "_");
        String refStr = referenceId != null ? "_REF-" + referenceId : "";
        return typeName + refStr + "_" + LocalDateTime.now().format(
                java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmm")) + ".pdf";
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }

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
     * Cree un enregistrement Invoice quand une FACTURE DocumentGeneration est produite.
     * L'echec de cette etape ne bloque pas la generation du document.
     */
    private void createInvoiceForFacture(ReferenceType referenceType, Long referenceId,
                                          String legalNumber, Long documentGenerationId, Long orgId) {
        try {
            invoiceGeneratorService.createIssuedFromDocumentGeneration(
                    referenceType, referenceId, orgId, legalNumber, documentGenerationId);
            log.info("Invoice creee pour facture {} ({} #{})", legalNumber, referenceType, referenceId);
        } catch (Exception e) {
            log.warn("Impossible de creer l'Invoice pour la facture {} : {}", legalNumber, e.getMessage());
        }
    }

    // ─── Generations par reference ──────────────────────────────────────────

    /**
     * Retourne les generations de documents pour un type de reference et un ID donnes.
     */
    @Transactional(readOnly = true)
    public List<DocumentGenerationDto> getGenerationsByReference(ReferenceType referenceType, Long referenceId) {
        return generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(referenceType, referenceId)
                .stream()
                .map(DocumentGenerationDto::fromEntity)
                .toList();
    }

    // ─── Historique ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<DocumentGenerationDto> listGenerations(Pageable pageable) {
        return generationRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(DocumentGenerationDto::fromEntity);
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
}
