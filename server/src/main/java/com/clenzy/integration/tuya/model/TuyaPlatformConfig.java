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

    /** Schema de l'App SDK Tuya (modele C) : requis pour provisionner les comptes app des hotes. */
    @Column(name = "app_schema")
    private String appSchema;

    /** AppKey de l'App SDK Tuya mobile <b>iOS</b> (init du SDK). */
    @Column(name = "app_key")
    private String appKey;

    /** AppSecret de l'App SDK Tuya mobile <b>iOS</b>, chiffre. */
    @Column(name = "app_secret_encrypted", columnDefinition = "TEXT")
    private String appSecretEncrypted;

    /** AppKey de l'App SDK Tuya mobile <b>Android</b> (couple distinct de l'iOS). */
    @Column(name = "android_app_key")
    private String androidAppKey;

    /** AppSecret de l'App SDK Tuya mobile <b>Android</b>, chiffre. */
    @Column(name = "android_app_secret_encrypted", columnDefinition = "TEXT")
    private String androidAppSecretEncrypted;

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

    public String getAppSchema() { return appSchema; }
    public void setAppSchema(String appSchema) { this.appSchema = appSchema; }

    public String getAppKey() { return appKey; }
    public void setAppKey(String appKey) { this.appKey = appKey; }

    public String getAppSecretEncrypted() { return appSecretEncrypted; }
    public void setAppSecretEncrypted(String appSecretEncrypted) { this.appSecretEncrypted = appSecretEncrypted; }

    public String getAndroidAppKey() { return androidAppKey; }
    public void setAndroidAppKey(String androidAppKey) { this.androidAppKey = androidAppKey; }

    public String getAndroidAppSecretEncrypted() { return androidAppSecretEncrypted; }
    public void setAndroidAppSecretEncrypted(String androidAppSecretEncrypted) { this.androidAppSecretEncrypted = androidAppSecretEncrypted; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
