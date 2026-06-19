package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Pipeline d'execution de la generation d'un document : numerotation legale,
 * resolution des tags, remplissage du template, conversion PDF, stockage,
 * verrouillage NF, creation de l'Invoice, envoi email, notifications, audit
 * et metriques.
 * <p>
 * Extrait de {@link DocumentGeneratorService} (refactor SRP) — comportement
 * strictement identique. Les methodes ne sont volontairement PAS
 * {@code @Transactional} : elles rejoignent la transaction du caller
 * ({@code generateDocument} / {@code generateFromEvent}), dont le rollback
 * pilote le retry Kafka (voir {@link DocumentGenerationFailureRecorder}).
 */
@Service
public class DocumentGenerationPipeline {

    private static final Logger log = LoggerFactory.getLogger(DocumentGenerationPipeline.class);

    private final DocumentGenerationRepository generationRepository;
    private final DocumentStorageService documentStorageService;
    private final TagResolverService tagResolverService;
    private final LibreOfficeConversionService conversionService;
    private final DocumentNumberingService numberingService;
    private final DocumentComplianceService complianceService;
    private final InvoiceGeneratorService invoiceGeneratorService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final TenantContext tenantContext;
    private final DocumentGenerationFailureRecorder failureRecorder;
    private final DocumentEmailDispatcher emailDispatcher;
    private final DocumentTemplateRenderer renderer;

    private final Counter generationSuccessCounter;
    private final Counter generationFailureCounter;
    private final Timer generationTimer;

    /**
     * Parametres d'une generation. {@code userId}/{@code userEmail} sont resolus
     * en amont par l'orchestrateur ("system" en contexte Kafka/public).
     * {@code explicitOrgId}/{@code explicitCountryCode} proviennent du payload
     * Kafka (TenantContext indisponible en consumer) ; null en contexte HTTP.
     */
    public record GenerationCommand(
            DocumentTemplate template,
            Long referenceId,
            ReferenceType referenceType,
            String emailTo,
            boolean sendEmail,
            String userId,
            String userEmail,
            Long explicitOrgId,
            String explicitCountryCode,
            boolean forceResend,
            String emailSubject,
            String emailBody
    ) {}

    public DocumentGenerationPipeline(
            DocumentGenerationRepository generationRepository,
            DocumentStorageService documentStorageService,
            TagResolverService tagResolverService,
            LibreOfficeConversionService conversionService,
            DocumentNumberingService numberingService,
            DocumentComplianceService complianceService,
            InvoiceGeneratorService invoiceGeneratorService,
            NotificationService notificationService,
            AuditLogService auditLogService,
            TenantContext tenantContext,
            DocumentGenerationFailureRecorder failureRecorder,
            DocumentEmailDispatcher emailDispatcher,
            DocumentTemplateRenderer renderer,
            MeterRegistry meterRegistry
    ) {
        this.generationRepository = generationRepository;
        this.documentStorageService = documentStorageService;
        this.tagResolverService = tagResolverService;
        this.conversionService = conversionService;
        this.numberingService = numberingService;
        this.complianceService = complianceService;
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.tenantContext = tenantContext;
        this.failureRecorder = failureRecorder;
        this.emailDispatcher = emailDispatcher;
        this.renderer = renderer;

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

    /**
     * Mode A : aucun template actif pour le type demande. Historiquement on
     * retournait null en silence -> le devis attendu n'apparaissait jamais en bas
     * de l'ecran "Messagerie OTA". On persiste une ligne FAILED explicite
     * (visible cote UI + notification admin) pour diagnostiquer la cause reelle
     * (ex: template DEVIS non seede/actif en production) au lieu d'echouer en silence.
     */
    public void recordMissingTemplateFailure(DocumentType documentType, Long referenceId,
                                             ReferenceType referenceType, Long organizationId,
                                             String emailTo) {
        log.warn("No active template for type {}, recording explicit failure", documentType);
        failureRecorder.recordFailure(
                documentType, referenceId, referenceType, organizationId, null, emailTo,
                "Aucun template actif pour le type " + documentType.getLabel()
                        + " (" + documentType.name() + "). Verifier qu'un template "
                        + documentType.name() + " est seede et actif.",
                0);
        generationFailureCounter.increment();
    }

    /**
     * Pipeline complet de generation. Voir {@link DocumentGeneratorService} pour
     * la description des etapes (1 a 10).
     */
    public DocumentGenerationDto execute(GenerationCommand command) {
        long startTime = System.currentTimeMillis();
        DocumentTemplate template = command.template();
        Long referenceId = command.referenceId();
        ReferenceType referenceType = command.referenceType();
        String emailTo = command.emailTo();

        // Resoudre l'organizationId : explicite (Kafka) > TenantContext (HTTP authentifie)
        // > organisation du template (contexte public/systeme sans tenant, ex: devis
        // genere depuis la landing page via /api/public/quote-request).
        //
        // Sans ce dernier fallback, une generation declenchee hors contexte tenant
        // serait persistee avec organization_id = NULL : elle resterait invisible pour
        // les utilisateurs filtres par organisation (organizationFilter Hibernate) — donc
        // absente du bas de l'ecran "Messagerie OTA" — et la numerotation legale NF serait
        // rattachee a une org nulle. On la rattache a l'org du template (= l'org Clenzy
        // qui possede le template DEVIS seede), garantissant coherence et visibilite.
        Long resolvedOrgId = command.explicitOrgId() != null
                ? command.explicitOrgId() : tenantContext.getOrganizationId();
        if (resolvedOrgId == null) {
            resolvedOrgId = template.getOrganizationId();
        }
        final Long orgId = resolvedOrgId;
        final String countryCode = command.explicitCountryCode() != null
                ? command.explicitCountryCode() : tenantContext.getCountryCode();

        // 1. Creer l'enregistrement via Builder
        DocumentGeneration generation = DocumentGeneration.builder()
                .template(template)
                .documentType(template.getDocumentType())
                .referenceId(referenceId)
                .referenceType(referenceType)
                .userId(command.userId())
                .userEmail(command.userEmail())
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
            byte[] templateContent = renderer.resolveTemplateContent(template);

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
            renderer.fillMissingTags(template, context, false); // tags optionnels : champ manquant -> vide, jamais d'echec

            // 4. Remplir le template via XDocReport
            byte[] filledOdt = renderer.fillTemplate(templateContent, context);

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

            // 9. Envoyer par email si demande — avec dedup (1 envoi par destinataire/document).
            if (command.sendEmail() && emailTo != null && !emailTo.isBlank()) {
                // Garde d'idempotence : si ce document a deja ete envoye a ce destinataire
                // pour cette reference (ex: envoi auto a la soumission du formulaire +
                // clic manuel "Generer PDF"), on ne renvoie pas. Un "Renvoyer" explicite
                // (forceResend=true) court-circuite cette garde.
                boolean alreadySent = emailDispatcher.isEmailAlreadySent(command.forceResend(),
                        referenceType, referenceId, template.getDocumentType(), emailTo);
                if (alreadySent) {
                    log.info("Email {} deja envoye a {} pour {}#{} — non renvoye (dedup)",
                            template.getDocumentType().name(), emailTo, referenceType.name(), referenceId);
                    generation.setEmailStatus("SKIPPED");
                } else {
                    try {
                        emailDispatcher.sendDocumentByEmail(template, emailTo, pdfFilename, pdfBytes,
                                command.emailSubject(), command.emailBody());
                        generation.setEmailStatus("SENT");
                        generation.setEmailSentAt(LocalDateTime.now());
                        generation.setStatus(DocumentGenerationStatus.SENT);

                        notificationService.notifyAdminsAndManagers(
                                NotificationKey.DOCUMENT_SENT_BY_EMAIL,
                                "Document envoye par email",
                                template.getDocumentType().getLabel() + " envoye a " + emailTo,
                                "/documents?tab=history&highlight=" + generation.getId(),
                                orgId
                        );
                    } catch (Exception emailEx) {
                        log.error("Failed to send document email: {}", emailEx.getMessage());
                        generation.setEmailStatus("FAILED");
                    }
                }
            }

            generation = generationRepository.save(generation);

            // 10. Notification + Audit + Metrics
            //     tab=history = onglet 'Historique' de la page Documents ;
            //     highlight = id de la DocumentGeneration pour le deep-link precis.
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATED,
                    "Document genere : " + template.getDocumentType().getLabel(),
                    pdfFilename + " (" + formatFileSize(pdfBytes.length) + ") genere en " + generationTimeMs + "ms",
                    "/documents?tab=history&highlight=" + generation.getId(),
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
        // IMPORTANT : la ligne GENERATING (generation) a ete sauvee dans la transaction du
        // caller (generateFromEvent / generateDocument, tous deux @Transactional). Or cette
        // transaction sera ROLLBACK par la re-jet de l'exception ci-dessous (necessaire au
        // retry Kafka pilote par DocumentEventService). Persister l'echec sur cette meme ligne
        // ici serait donc annule -> echec silencieux (symptome historique : aucune ligne FAILED
        // ne remontait jamais en bas de "Messagerie OTA").
        //
        // On delegue l'ecriture a un bean REQUIRES_NEW qui INSERE une nouvelle ligne FAILED
        // committee independamment du rollback du caller (voir DocumentGenerationFailureRecorder).
        int generationTimeMs = (int) (System.currentTimeMillis() - startTime);
        failureRecorder.recordFailure(
                generation.getDocumentType(),
                generation.getReferenceId(),
                generation.getReferenceType(),
                orgId,
                template != null ? template.getId() : null,
                generation.getEmailTo(),
                e.getMessage(),
                generationTimeMs);

        generationFailureCounter.increment();
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

    static String buildPdfFilename(DocumentType type, Long referenceId) {
        String typeName = type.getLabel().replace(" ", "_");
        String refStr = referenceId != null ? "_REF-" + referenceId : "";
        // Horodatage du nom de fichier en heure metier (Europe/Paris), jamais la
        // zone JVM (UTC en prod) qui donnait un decalage de 2h (regle dates #9).
        return typeName + refStr + "_" + LocalDateTime.now(java.time.ZoneId.of("Europe/Paris")).format(
                java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmm")) + ".pdf";
    }

    static String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
