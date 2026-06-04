package com.clenzy.integration.tuya.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Configuration plateforme du projet Tuya Cloud (credentials), editable depuis l'UI et stockee
 * en base. Singleton (une seule ligne) : ce sont les credentials PLATEFORME (un projet Tuya pour
 * tout Clenzy), donc volontairement <b>NON org-scopee</b>. Le secret est chiffre (AES-256-GCM).
 */
@Entity
@Table(name = "tuya_platform_config")
public class TuyaPlatformConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "access_id")
    private String accessId;

    @Column(name = "access_secret_encrypted", columnDefinition = "TEXT")
    private String accessSecretEncrypted;

    @Column(name = "base_url")
    private String baseUrl;

    @Column(name = "region", length = 20)
    private String region;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public String getAccessId() { return accessId; }
    public void setAccessId(String accessId) { this.accessId = accessId; }

    public String getAccessSecretEncrypted() { return accessSecretEncrypted; }
    public void setAccessSecretEncrypted(String accessSecretEncrypted) { this.accessSecretEncrypted = accessSecretEncrypted; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
