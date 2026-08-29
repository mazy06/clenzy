package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Photo jointe a un signalement d'anomalie.
 *
 * <p>Le signalement decrivait l'anomalie par du texte seul. Ces photos sont
 * prises AVANT toute intervention — elles ne se confondent donc pas avec les
 * photos avant/apres d'une {@link Intervention}, qui documentent l'execution.</p>
 *
 * <p>Comme {@link InterventionPhoto} : {@code data} porte le binaire en local,
 * {@code storageKey} reference l'objet distant apres migration.</p>
 */
@Entity
@Table(name = "issue_photos")
@Filter(name = "organizationFilter", condition = "organization_id = :organizationId")
public class IssuePhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_id", nullable = false)
    private Long issueId;

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

    @Column(name = "uploaded_by_id")
    private Long uploadedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public Long getIssueId() { return issueId; }
    public void setIssueId(Long issueId) { this.issueId = issueId; }

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

    public Long getUploadedById() { return uploadedById; }
    public void setUploadedById(Long uploadedById) { this.uploadedById = uploadedById; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Adresse de lecture du binaire. Voir {@code PropertyPhoto.getUrl}. */
    public String getUrl() {
        return id != null && issueId != null
                ? "/api/issues/" + issueId + "/photos/" + id + "/data"
                : null;
    }
}
