package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/**
 * Enregistrement de chaque generation de document : template utilise, statut, fichier genere, email.
 */
@Entity
@Table(name = "document_generations")
@org.hibernate.annotations.FilterDef(
    name = "organizationFilter",
    parameters = @org.hibernate.annotations.ParamDef(name = "orgId", type = Long.class)
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class DocumentGeneration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private DocumentTemplate template;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 50)
    private DocumentType documentType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type", length = 50)
    private ReferenceType referenceType;

    @Column(name = "user_id", length = 100)
    private String userId;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentGenerationStatus status = DocumentGenerationStatus.PENDING;

    @Column(name = "email_to", length = 255)
    private String emailTo;

    @Column(name = "email_status", length = 20)
    private String emailStatus;

    @Column(name = "email_sent_at")
    private LocalDateTime emailSentAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "generation_time_ms")
    private Integer generationTimeMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // ─── Conformite NF ────────────────────────────────────────────────────────────

    /** Numero legal sequentiel (ex: FAC-2025-00001) pour FACTURE/DEVIS */
    @Column(name = "legal_number", length = 50)
    private String legalNumber;

    /** Hash SHA-256 du contenu PDF pour verification d'integrite */
    @Column(name = "document_hash", length = 128)
    private String documentHash;

    /** Document verrouille (immutable) apres generation */
    @Column(nullable = false)
    private boolean locked = false;

    /** Date de verrouillage */
    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    /** ID du document original corrige (pour avoir / correction) */
    @Column(name = "corrects_id")
    private Long correctsId;

    // ─── Builder ────────────────────────────────────────────────────────────────

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private final DocumentGeneration gen = new DocumentGeneration();

        public Builder template(DocumentTemplate template) { gen.template = template; return this; }
        public Builder documentType(DocumentType type) { gen.documentType = type; return this; }
        public Builder referenceId(Long referenceId) { gen.referenceId = referenceId; return this; }
        public Builder referenceType(ReferenceType type) { gen.referenceType = type; return this; }
        public Builder userId(String userId) { gen.userId = userId; return this; }
        public Builder userEmail(String userEmail) { gen.userEmail = userEmail; return this; }
        public Builder status(DocumentGenerationStatus status) { gen.status = status; return this; }
        public Builder emailTo(String emailTo) { gen.emailTo = emailTo; return this; }

        public DocumentGeneration build() {
            return gen;
        }
    }

    // ─── Getters / Setters ────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public DocumentTemplate getTemplate() { return template; }
    public void setTemplate(DocumentTemplate template) { this.template = template; }

    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }

    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }

    public ReferenceType getReferenceType() { return referenceType; }
    public void setReferenceType(ReferenceType referenceType) { this.referenceType = referenceType; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public DocumentGenerationStatus getStatus() { return status; }
    public void setStatus(DocumentGenerationStatus status) { this.status = status; }

    public String getEmailTo() { return emailTo; }
    public void setEmailTo(String emailTo) { this.emailTo = emailTo; }

    public String getEmailStatus() { return emailStatus; }
    public void setEmailStatus(String emailStatus) { this.emailStatus = emailStatus; }

    public LocalDateTime getEmailSentAt() { return emailSentAt; }
    public void setEmailSentAt(LocalDateTime emailSentAt) { this.emailSentAt = emailSentAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Integer getGenerationTimeMs() { return generationTimeMs; }
    public void setGenerationTimeMs(Integer generationTimeMs) { this.generationTimeMs = generationTimeMs; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    // ─── NF Getters / Setters ─────────────────────────────────────────────────────

    public String getLegalNumber() { return legalNumber; }
    public void setLegalNumber(String legalNumber) { this.legalNumber = legalNumber; }

    public String getDocumentHash() { return documentHash; }
    public void setDocumentHash(String documentHash) { this.documentHash = documentHash; }

    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }

    public LocalDateTime getLockedAt() { return lockedAt; }
    public void setLockedAt(LocalDateTime lockedAt) { this.lockedAt = lockedAt; }

    public Long getCorrectsId() { return correctsId; }
    public void setCorrectsId(Long correctsId) { this.correctsId = correctsId; }
}
