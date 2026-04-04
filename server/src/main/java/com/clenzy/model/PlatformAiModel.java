package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Modele IA configure au niveau plateforme.
 *
 * Chaque enregistrement represente un modele specifique (ex: "GPT-4o", "Claude Sonnet")
 * avec ses credentials. Un modele peut etre assigne a une ou plusieurs features
 * via {@link PlatformAiFeatureModel}.
 *
 * La cle API est chiffree au repos via Jasypt AES-256.
 */
@Entity
@Table(name = "platform_ai_model")
public class PlatformAiModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "model_id", nullable = false, length = 150)
    private String modelId;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "api_key", nullable = false, columnDefinition = "TEXT")
    private String apiKey;

    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(name = "last_validated_at")
    private LocalDateTime lastValidatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    // ─── Constructors ────────────────────────────────────────────────────

    public PlatformAiModel() {}

    public PlatformAiModel(String name, String provider, String modelId, String apiKey, String baseUrl) {
        this.name = name;
        this.provider = provider;
        this.modelId = modelId;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    public String getMaskedApiKey() {
        if (apiKey == null || apiKey.length() <= 4) return "****";
        return "*".repeat(apiKey.length() - 4) + apiKey.substring(apiKey.length() - 4);
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public LocalDateTime getLastValidatedAt() { return lastValidatedAt; }
    public void setLastValidatedAt(LocalDateTime lastValidatedAt) { this.lastValidatedAt = lastValidatedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
