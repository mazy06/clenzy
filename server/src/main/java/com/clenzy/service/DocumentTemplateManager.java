package com.clenzy.service;

import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Cycle de vie des templates de documents : upload, mise a jour des metadata,
 * activation exclusive par type, suppression, remplacement du fichier source
 * et re-parsing des tags.
 * <p>
 * Extrait de {@link DocumentGeneratorService} (refactor SRP) — comportement
 * strictement identique.
 */
@Service
public class DocumentTemplateManager {

    private static final Logger log = LoggerFactory.getLogger(DocumentTemplateManager.class);

    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository tagRepository;
    private final DocumentTemplateStorageService templateStorageService;
    private final TemplateParserService templateParserService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final TenantContext tenantContext;
    private final DocumentTemplateRenderer renderer;

    public DocumentTemplateManager(
            DocumentTemplateRepository templateRepository,
            DocumentTemplateTagRepository tagRepository,
            DocumentTemplateStorageService templateStorageService,
            TemplateParserService templateParserService,
            NotificationService notificationService,
            AuditLogService auditLogService,
            TenantContext tenantContext,
            DocumentTemplateRenderer renderer
    ) {
        this.templateRepository = templateRepository;
        this.tagRepository = tagRepository;
        this.templateStorageService = templateStorageService;
        this.templateParserService = templateParserService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.tenantContext = tenantContext;
        this.renderer = renderer;
    }

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
                                           String emailSubject, String emailBody, String createdBy) {
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
        template.setCreatedBy(createdBy);
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

    /**
     * Remplace le fichier source d'un template existant par un nouveau .odt,
     * sans changer son ID ni ses metadata (nom, description, documentType...).
     * Re-parse automatiquement les tags du nouveau fichier.
     *
     * Cas d'usage : iterer sur un template (mise a jour de la mise en page,
     * correction d'un tag) sans casser les references existantes (active flag,
     * generations passees, etc.).
     */
    @Transactional
    public DocumentTemplate replaceTemplateFile(Long id, MultipartFile file) {
        DocumentTemplate template = getTemplate(id);

        // ── Validation ──
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".odt")) {
            throw new DocumentValidationException("Seuls les fichiers .odt sont acceptes");
        }
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new DocumentValidationException("Nom de fichier invalide");
        }

        byte[] fileContent;
        try {
            fileContent = file.getBytes();
        } catch (java.io.IOException e) {
            throw new DocumentStorageException("Failed to read uploaded file", e);
        }

        String oldFilename = template.getOriginalFilename();

        // ── Parse les tags AVANT de toucher l'entite (validation precoce) ──
        List<DocumentTemplateTag> newTags = templateParserService.parseTemplate(fileContent);

        // ── Libere l'ancien storage disque si necessaire ──
        if (template.getFilePath() != null && !template.getFilePath().isBlank()) {
            templateStorageService.delete(template.getFilePath());
            template.setFilePath(null);
        }

        // ── Update fichier + filename (auto-flush au commit @Transactional) ──
        template.setFileContent(fileContent);
        template.setOriginalFilename(filename);

        // ── Remplacement des tags par MUTATION pure de la collection managee ──
        // L'entite DocumentTemplate a @OneToMany(cascade=ALL, orphanRemoval=true)
        // sur tags. Hibernate IMPOSE :
        //  - Muter la collection existante (clear/add), JAMAIS setTags(newList).
        //    Sinon → "A collection with cascade=all-delete-orphan was no longer
        //    referenced by the owning entity instance".
        //  - Pas de tagRepository.deleteByTemplateId/saveAll en parallele : ca
        //    cree des conflits d'ordre INSERT/DELETE → violation de contrainte
        //    unique (template_id, tag_name).
        //
        // Solution : clear() + flush() (force le DELETE des orphans en SQL) puis
        // add() + auto-flush au commit (emet les INSERTs). Hibernate s'occupe de
        // tout, dans le bon ordre.
        template.getTags().clear();
        templateRepository.flush();  // emet les DELETE des orphans avant les INSERT

        for (DocumentTemplateTag tag : newTags) {
            tag.setTemplate(template);
            template.getTags().add(tag);
        }

        auditLogService.logUpdate("DocumentTemplate", String.valueOf(id),
                oldFilename, filename,
                "Replace template file: " + filename + " (" + newTags.size() + " tags)");
        log.info("Template file replaced: {} (id={}, file={}, {} tags)",
                template.getName(), id, filename, newTags.size());
        return template;
    }

    @Transactional
    public DocumentTemplate reparseTemplate(Long id) {
        DocumentTemplate template = getTemplate(id);
        tagRepository.deleteByTemplateId(id);

        byte[] content = renderer.resolveTemplateContent(template);
        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(content);
        for (DocumentTemplateTag tag : tags) {
            tag.setTemplate(template);
        }
        tagRepository.saveAll(tags);
        template.setTags(tags);

        log.info("Template re-parsed: {} ({} tags)", template.getName(), tags.size());
        return template;
    }

    /**
     * Retourne le contenu binaire du fichier source du template (.odt).
     * Utile pour exposer le template d'origine au PMS (telechargement,
     * inspection, archivage).
     */
    @Transactional(readOnly = true)
    public byte[] getTemplateOriginalContent(Long id) {
        DocumentTemplate template = getTemplate(id);
        return renderer.resolveTemplateContent(template);
    }

    private DocumentType parseDocumentType(String value) {
        try {
            return DocumentType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new DocumentValidationException("Type de document inconnu: " + value);
        }
    }
}
