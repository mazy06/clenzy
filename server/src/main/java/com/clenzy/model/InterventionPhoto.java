package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Photo avant/apres d'une intervention (menage, maintenance).
 *
 * Phases :
 * - BEFORE : photo prise avant l'intervention
 * - AFTER  : photo prise apres l'intervention
 * - ISSUE  : photo d'un probleme constate pendant l'intervention
 *
 * Le champ data (BYTEA) stocke le binaire en local.
 * Le champ storageKey reference le fichier dans S3 quand clenzy.storage.type=s3.
 */
@Entity
@Table(name = "intervention_photos")
@Filter(name = "organizationFilter", condition = "organization_id = :organizationId")
public class InterventionPhoto {

    public enum PhotoPhase {
        BEFORE, AFTER, ISSUE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "intervention_id", nullable = false)
    private Intervention intervention;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType = "image/jpeg";

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "data", columnDefinition = "bytea")
    @Basic(fetch = FetchType.LAZY)
    private byte[] data;

    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 20)
    private PhotoPhase phase = PhotoPhase.BEFORE;

    @Column(name = "caption", length = 500)
    private String caption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public InterventionPhoto() {}

    // ── Getters & Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }

    public Intervention getIntervention() { return intervention; }
    public void setIntervention(Intervention intervention) { this.intervention = intervention; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public PhotoPhase getPhase() { return phase; }
    public void setPhase(PhotoPhase phase) { this.phase = phase; }

    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }

    public User getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(User uploadedBy) { this.uploadedBy = uploadedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
