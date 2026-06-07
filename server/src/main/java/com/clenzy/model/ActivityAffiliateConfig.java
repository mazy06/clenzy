package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Config d'affiliation d'un provider d'activites (Viator/GetYourGuide/Klook)
 * pour une organisation. Cle API chiffree au repos ({@link EncryptedFieldConverter}).
 * Une ligne par (organization_id, provider).
 */
@Entity
@Table(name = "activity_affiliate_configs")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ActivityAffiliateConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 30)
    private ActivityProvider provider;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "api_key", columnDefinition = "TEXT")
    private String apiKey;

    @Column(name = "affiliate_id", length = 200)
    private String affiliateId;

    @Column(nullable = false)
    private boolean enabled = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public ActivityProvider getProvider() { return provider; }
    public void setProvider(ActivityProvider provider) { this.provider = provider; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getAffiliateId() { return affiliateId; }
    public void setAffiliateId(String affiliateId) { this.affiliateId = affiliateId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
