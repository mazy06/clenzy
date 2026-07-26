package com.clenzy.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Média de la médiathèque (2.1) — org-scopé. Référencé par les champs image des blocs du Studio
 * (logos, galeries, avatars…). Le binaire vit dans le {@code PhotoStorageService} (S3 ou BYTEA selon
 * profil) ; cette table porte les métadonnées + le lien org. Servi publiquement via
 * {@code GET /api/public/media/t/{publicToken}} (le contenu est destiné au site/widget public).
 *
 * <p>La route historique {@code /api/public/media/{id}} reste servie pour les pages déjà
 * publiées, mais elle est <b>dépréciée</b> : l'identifiant est séquentiel, ce qui rendait
 * toute la médiathèque de toutes les organisations énumérable par un anonyme (audit
 * 2026-07-26, constat P1-06). {@link #publicToken} est l'identifiant public à utiliser.
 */
@Entity
@Table(name = "media_assets", indexes = { @Index(name = "idx_media_assets_org", columnList = "organization_id") })
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /**
     * Identifiant public opaque, seul à figurer dans les URLs servies aux visiteurs.
     * Généré à la création : un média n'est jamais atteignable par devinette, y compris
     * lorsqu'il est déposé sans être publié dans une page.
     */
    @Column(name = "public_token", nullable = false, updatable = false)
    private UUID publicToken = UUID.randomUUID();

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
    public UUID getPublicToken() { return publicToken; }
    public void setPublicToken(UUID publicToken) { this.publicToken = publicToken; }
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
