package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Photo de l'emplacement exact d'un point de remise des cles (boite a cles,
 * comptoir d'un commercant). L'adresse situe le point ; la photo permet de le
 * trouver sur place.
 *
 * <p>Les octets vivent sur le stockage objet, seule la cle est enregistree ici.</p>
 */
@Entity
@Table(name = "key_exchange_point_photos")
@Filter(name = "organizationFilter", condition = "organization_id = :organizationId")
public class KeyExchangePointPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "point_id", nullable = false)
    private Long pointId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType = "image/jpeg";

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "uploaded_by_id")
    private Long uploadedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public Long getPointId() { return pointId; }
    public void setPointId(Long pointId) { this.pointId = pointId; }

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

    public Long getUploadedById() { return uploadedById; }
    public void setUploadedById(Long uploadedById) { this.uploadedById = uploadedById; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
