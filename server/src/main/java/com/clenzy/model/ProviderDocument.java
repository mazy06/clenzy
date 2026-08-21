package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Justificatif professionnel d'un INTERVENANT (menage, maintenance,
 * blanchisserie, exterieurs).
 *
 * <p>Une conciergerie qui fait travailler des independants doit collecter et
 * conserver ces pieces : c'est une obligation legale, pas un confort. L'absence
 * d'attestation de vigilance expose le donneur d'ordre a la solidarite
 * financiere en cas de travail dissimule.</p>
 *
 * <p>Le binaire vit dans le {@code PhotoStorageService} (S3 ou BYTEA selon le
 * profil) ; cette table porte les metadonnees et le lien vers l'utilisateur.</p>
 *
 * <p>Le document est rattache a l'UTILISATEUR et non a l'organisation : un
 * independant peut travailler pour plusieurs conciergeries avec les memes
 * pieces. La colonne {@code organization_id} sert au cloisonnement de lecture
 * cote gestionnaire, elle ne duplique pas le document.</p>
 */
@Entity
@Table(
    name = "provider_documents",
    indexes = {
        @Index(name = "idx_provider_documents_user", columnList = "user_id"),
        @Index(name = "idx_provider_documents_org", columnList = "organization_id"),
    }
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ProviderDocument {

    /**
     * Pieces attendues d'un prestataire independant.
     *
     * <p>{@code URSSAF_VIGILANCE} a une validite de SIX MOIS : c'est la seule
     * qui se perime d'office, d'ou {@link #expiresAt} et le rappel qui en
     * decoule. Les autres n'expirent que si l'emetteur le prevoit.</p>
     */
    public enum DocumentType {
        /** Extrait Kbis ou avis de situation SIRENE. */
        COMPANY_REGISTRATION,
        /** Attestation de vigilance URSSAF — validite 6 mois. */
        URSSAF_VIGILANCE,
        /** Assurance responsabilite civile professionnelle. */
        LIABILITY_INSURANCE,
        /** Piece d'identite du representant. */
        IDENTITY,
        /** Autre piece demandee par la conciergerie. */
        OTHER
    }

    /** Cycle de vie cote gestionnaire : depose, puis valide ou refuse. */
    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "organization_id")
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 40)
    private DocumentType documentType;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    /** Date d'expiration declaree (obligatoire pour l'attestation de vigilance). */
    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    /** Motif de refus, rendu a l'intervenant pour qu'il sache quoi corriger. */
    @Column(name = "review_note", length = 500)
    private String reviewNote;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public ProviderDocument() {}

    /** Le document est-il exploitable aujourd'hui : valide et non perime. */
    public boolean isCurrentlyValid() {
        if (status != Status.APPROVED) return false;
        return expiresAt == null || !expiresAt.isBefore(LocalDate.now());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }

    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public LocalDate getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDate expiresAt) { this.expiresAt = expiresAt; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }

    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
