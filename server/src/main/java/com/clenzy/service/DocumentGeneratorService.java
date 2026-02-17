package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.*;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
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

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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
        return templateRepository.findById(id)
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

        DocumentType documentType = parseDocumentType(documentTypeStr);

        String filePath = templateStorageService.store(file);

        DocumentTemplate template = new DocumentTemplate();
        template.setName(name);
        template.setDescription(description);
        template.setDocumentType(documentType);
        template.setEventTrigger(eventTrigger);
        template.setFilePath(filePath);
        template.setOriginalFilename(originalFilename);
        template.setEmailSubject(emailSubject);
        template.setEmailBody(emailBody);
        template.setCreatedBy(extractEmail(jwt));
        template.setActive(false);

        template = templateRepository.save(template);

        Path absolutePath = templateStorageService.getAbsolutePath(filePath);
        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(absolutePath);
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
        templateRepository.deactivateAllByTypeExcept(template.getDocumentType(), id);
        template.setActive(true);
        return templateRepository.save(template);
    }

    @Transactional
    public void deleteTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        tagRepository.deleteByTemplateId(id);
        templateStorageService.delete(template.getFilePath());
        templateRepository.delete(template);

        auditLogService.logDelete("DocumentTemplate", String.valueOf(id),
                "Delete template: " + template.getName());
        log.info("Template deleted: {} (id={})", template.getName(), id);
    }

    @Transactional
    public DocumentTemplate reparseTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        tagRepository.deleteByTemplateId(id);

        Path absolutePath = templateStorageService.getAbsolutePath(template.getFilePath());
        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(absolutePath);
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

        DocumentTemplate template = templateRepository.findByDocumentTypeAndActiveTrue(documentType)
                .orElseThrow(() -> new DocumentNotFoundException(
                        "Aucun template actif pour le type: " + documentType.getLabel()));

        return executeGeneration(template, request.referenceId(), referenceType,
                request.emailTo(), request.sendEmail(), jwt);
    }

    @Transactional
    public DocumentGenerationDto generateFromEvent(DocumentType documentType, Long referenceId,
                                                     ReferenceType referenceType, String emailTo) {
        DocumentTemplate template = templateRepository.findByDocumentTypeAndActiveTrue(documentType)
                .orElse(null);

        if (template == null) {
            log.warn("No active template for type {}, skipping generation", documentType);
            return null;
        }

        return executeGeneration(template, referenceId, referenceType,
                emailTo, emailTo != null && !emailTo.isBlank(), null);
    }

    /**
     * Pipeline complet de generation.
     */
    private DocumentGenerationDto executeGeneration(DocumentTemplate template, Long referenceId,
                                                     ReferenceType referenceType, String emailTo,
                                                     boolean sendEmail, Jwt jwt) {
        long startTime = System.currentTimeMillis();

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
        generation = generationRepository.save(generation);

        try {
            // 2.5 [NF] Generer le numero legal sequentiel (FACTURE/DEVIS)
            String legalNumber = null;
            if (numberingService.requiresLegalNumber(template.getDocumentType())) {
                legalNumber = numberingService.generateNextNumber(template.getDocumentType());
                generation.setLegalNumber(legalNumber);
                generationRepository.save(generation);
                log.info("Numero legal attribue: {} pour generation #{}", legalNumber, generation.getId());
            }

            // 2. Charger le template .odt
            Path templatePath = templateStorageService.getAbsolutePath(template.getFilePath());

            // 3. Resoudre les tags
            Map<String, Object> context = tagResolverService.resolveTagsForDocument(
                    template.getDocumentType(), referenceId,
                    referenceType != null ? referenceType.name() : null);

            // 3.5 [NF] Injecter les tags NF (numero legal, mentions legales)
            if (legalNumber != null) {
                Map<String, Object> nfTags = complianceService.resolveNfTags(
                        template.getDocumentType(), legalNumber);
                context.put("nf", nfTags);
            }

            // 4. Remplir le template via XDocReport
            byte[] filledOdt = fillTemplate(templatePath, context);

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
            if (numberingService.requiresLegalNumber(template.getDocumentType())) {
                complianceService.lockDocument(generation, pdfBytes);
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
                            "/documents"
                    );
                } catch (Exception emailEx) {
                    log.error("Failed to send document email: {}", emailEx.getMessage());
                    generation.setEmailStatus("FAILED");
                }
            }

            generation = generationRepository.save(generation);

            // 10. Notification + Audit + Metrics
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATED,
                    "Document genere : " + template.getDocumentType().getLabel(),
                    pdfFilename + " (" + formatFileSize(pdfBytes.length) + ") genere en " + generationTimeMs + "ms",
                    "/documents"
            );

            auditLogService.logAction(AuditAction.DOCUMENT_GENERATE, "DocumentGeneration",
                    String.valueOf(generation.getId()), null, null,
                    "Generated: " + pdfFilename + " (" + generationTimeMs + "ms)",
                    AuditSource.WEB);

            generationSuccessCounter.increment();
            generationTimer.record(java.time.Duration.ofMillis(generationTimeMs));

            log.info("Document generated: {} (id={}, {}ms, {} bytes)",
                    pdfFilename, generation.getId(), generationTimeMs, pdfBytes.length);

            return DocumentGenerationDto.fromEntity(generation);

        } catch (DocumentValidationException e) {
            log.warn("Document generation invalid request: {}", e.getMessage());
            handleGenerationFailure(generation, template, startTime, e);
            throw e;
        } catch (DocumentNotFoundException e) {
            log.warn("Document generation missing data: {}", e.getMessage());
            handleGenerationFailure(generation, template, startTime, e);
            throw e;
        } catch (DocumentStorageException e) {
            log.error("Document generation storage error: {}", e.getMessage(), e);
            handleGenerationFailure(generation, template, startTime, e);
            throw new DocumentGenerationException("Erreur de stockage lors de la generation: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Document generation failed: {}", e.getMessage(), e);
            handleGenerationFailure(generation, template, startTime, e);
            throw new DocumentGenerationException("Generation du document echouee: " + e.getMessage(), e);
        }
    }

    private void handleGenerationFailure(DocumentGeneration generation, DocumentTemplate template,
                                           long startTime, Exception e) {
        generation.setStatus(DocumentGenerationStatus.FAILED);
        generation.setErrorMessage(e.getMessage());
        generation.setGenerationTimeMs((int) (System.currentTimeMillis() - startTime));
        generationRepository.save(generation);

        notificationService.notifyAdminsAndManagers(
                NotificationKey.DOCUMENT_GENERATION_FAILED,
                "Echec generation document",
                template.getDocumentType().getLabel() + " : " + e.getMessage(),
                "/documents"
        );

        generationFailureCounter.increment();
    }

    private byte[] fillTemplate(Path templatePath, Map<String, Object> contextMap) throws Exception {
        try (InputStream is = Files.newInputStream(templatePath)) {
            IXDocReport report = XDocReportRegistry.getRegistry().loadReport(
                    is, TemplateEngineKind.Freemarker);

            IContext context = report.createContext();
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
