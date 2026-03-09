package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "payment_method_configs", indexes = {
    @Index(name = "idx_pmc_org", columnList = "organization_id")
}, uniqueConstraints = {
    @UniqueConstraint(columnNames = {"organization_id", "provider_type"})
})
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PaymentMethodConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 30)
    private PaymentProviderType providerType;

    @Column(nullable = false)
    private Boolean enabled = false;

    @Column(name = "country_codes", length = 100)
    private String countryCodes;

    @Column(name = "api_key_encrypted", columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    @Column(name = "webhook_secret_encrypted", columnDefinition = "TEXT")
    private String webhookSecretEncrypted;

    @Column(name = "sandbox_mode")
    private Boolean sandboxMode = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_json", columnDefinition = "jsonb")
    private Map<String, Object> configJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Check if this config supports a given country code.
     */
    public boolean supportsCountry(String countryCode) {
        if (countryCodes == null || countryCodes.isBlank() || "*".equals(countryCodes)) {
            return true;
        }
        return getCountryCodesList().contains(countryCode);
    }

    public List<String> getCountryCodesList() {
        if (countryCodes == null || countryCodes.isBlank()) return List.of();
        return Arrays.stream(countryCodes.split(","))
            .map(String::trim)
            .toList();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public PaymentProviderType getProviderType() { return providerType; }
    public void setProviderType(PaymentProviderType providerType) { this.providerType = providerType; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public String getCountryCodes() { return countryCodes; }
    public void setCountryCodes(String countryCodes) { this.countryCodes = countryCodes; }
    public String getApiKeyEncrypted() { return apiKeyEncrypted; }
    public void setApiKeyEncrypted(String apiKeyEncrypted) { this.apiKeyEncrypted = apiKeyEncrypted; }
    public String getApiSecretEncrypted() { return apiSecretEncrypted; }
    public void setApiSecretEncrypted(String apiSecretEncrypted) { this.apiSecretEncrypted = apiSecretEncrypted; }
    public String getWebhookSecretEncrypted() { return webhookSecretEncrypted; }
    public void setWebhookSecretEncrypted(String webhookSecretEncrypted) { this.webhookSecretEncrypted = webhookSecretEncrypted; }
    public Boolean getSandboxMode() { return sandboxMode; }
    public void setSandboxMode(Boolean sandboxMode) { this.sandboxMode = sandboxMode; }
    public Map<String, Object> getConfigJson() { return configJson; }
    public void setConfigJson(Map<String, Object> configJson) { this.configJson = configJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
