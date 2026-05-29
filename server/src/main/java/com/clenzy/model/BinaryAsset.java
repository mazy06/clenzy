package com.clenzy.model;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Stockage Postgres BYTEA pour les assets binaires Clenzy (avatars users en V1,
 * puis contact files et property photos quand on uniformisera).
 *
 * <h3>Cle logique</h3>
 * Le {@code storageKey} est une chaine arbitraire choisie par le service appelant
 * (ex: {@code "users/42/abc-123.png"} pour les avatars). Unique pour permettre
 * l'upsert idempotent ; le service peut soit garder le meme key (overwrite) soit
 * generer un nouveau key et delete l'ancien (versionning).
 *
 * <h3>Roadmap S3</h3>
 * <b>TODO</b> : a la migration AWS, implementer {@code S3BinaryAssetStorage}.
 * On pourra soit (a) garder cette table comme cache/metadonnees et stocker les
 * bytes en S3, soit (b) migrer entierement et drop la colonne {@code bytes}.
 * Voir {@code com.clenzy.service.storage.BinaryAssetStorage}.
 */
@Entity
@Table(name = "binary_asset")
public class BinaryAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Cle logique, ex: {@code "users/42/abc-123.png"}. Unique en DB. */
    @Column(name = "storage_key", nullable = false, length = 512, unique = true)
    private String storageKey;

    /** MIME type, ex: {@code "image/png"}. */
    @Column(name = "content_type", nullable = false, length = 128)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Lob
    @Column(name = "bytes", nullable = false, columnDefinition = "BYTEA")
    private byte[] bytes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public BinaryAsset() {}

    @PreUpdate
    void touchUpdatedAt() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public byte[] getBytes() { return bytes; }
    public void setBytes(byte[] bytes) { this.bytes = bytes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
