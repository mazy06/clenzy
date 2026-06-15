package com.clenzy.model;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Média de la médiathèque (2.1) — org-scopé. Référencé par les champs image des blocs du Studio
 * (logos, galeries, avatars…). Le binaire vit dans le {@code PhotoStorageService} (S3 ou BYTEA selon
 * profil) ; cette table porte les métadonnées + le lien org. Servi publiquement via
 * {@code GET /api/public/media/{id}} (le contenu est destiné au site/widget public).
 */
@Entity
@Table(name = "media_assets", indexes = { @Index(name = "idx_media_assets_org", columnList = "organization_id") })
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 128)
    private String contentType;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
