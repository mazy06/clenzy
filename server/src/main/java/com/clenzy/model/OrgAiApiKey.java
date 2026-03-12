package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Cle API IA par organisation (BYOK — Bring Your Own Key).
 *
 * Permet a une organisation de connecter son propre compte OpenAI/Anthropic
 * au lieu d'utiliser la cle partagee de la plateforme.
 * La cle est chiffree au repos via Jasypt AES-256.
 */
@Entity
@Table(name = "org_ai_api_keys", indexes = {
        @Index(name = "idx_org_ai_api_keys_org", columnList = "organization_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_org_ai_api_keys_org_provider",
                          columnNames = {"organization_id", "provider"})
})
public class OrgAiApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 30)
    private String provider; // "openai" or "anthropic"

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "api_key", nullable = false, columnDefinition = "TEXT")
    private String apiKey;

    @Column(name = "model_override", length = 100)
    private String modelOverride;

    @Column(name = "is_valid", nullable = false)
    private boolean valid = false;

    @Column(name = "last_validated_at")
    private LocalDateTime lastValidatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Constructors ────────────────────────────────────────────────────

    public OrgAiApiKey() {}

    public OrgAiApiKey(Long organizationId, String provider, String apiKey) {
        this.organizationId = organizationId;
        this.provider = provider;
        this.apiKey = apiKey;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * Retourne une version masquee de la cle (seuls les 4 derniers caracteres sont visibles).
     */
    public String getMaskedApiKey() {
        if (apiKey == null || apiKey.length() <= 4) return "****";
        return "*".repeat(apiKey.length() - 4) + apiKey.substring(apiKey.length() - 4);
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getModelOverride() { return modelOverride; }
    public void setModelOverride(String modelOverride) { this.modelOverride = modelOverride; }

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }

    public LocalDateTime getLastValidatedAt() { return lastValidatedAt; }
    public void setLastValidatedAt(LocalDateTime lastValidatedAt) { this.lastValidatedAt = lastValidatedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
