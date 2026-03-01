package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "external_pricing_configs")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ExternalPricingConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PricingProvider provider;

    @Column(name = "api_key")
    private String apiKey;

    @Column(name = "api_url")
    private String apiUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "property_mappings", columnDefinition = "jsonb")
    private Map<String, String> propertyMappings = new HashMap<>();

    @Column(length = 3)
    private String currency = "EUR";

    @Column(nullable = false)
    private Boolean enabled = false;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "sync_interval_hours")
    private Integer syncIntervalHours = 6;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public PricingProvider getProvider() { return provider; }
    public void setProvider(PricingProvider provider) { this.provider = provider; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    public Map<String, String> getPropertyMappings() { return propertyMappings; }
    public void setPropertyMappings(Map<String, String> propertyMappings) { this.propertyMappings = propertyMappings; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Instant getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(Instant lastSyncAt) { this.lastSyncAt = lastSyncAt; }
    public Integer getSyncIntervalHours() { return syncIntervalHours; }
    public void setSyncIntervalHours(Integer syncIntervalHours) { this.syncIntervalHours = syncIntervalHours; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
