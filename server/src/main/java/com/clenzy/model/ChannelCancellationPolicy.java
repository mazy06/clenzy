package com.clenzy.model;

import com.clenzy.integration.channel.ChannelName;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "channel_cancellation_policies")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ChannelCancellationPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel_name", nullable = false, length = 50)
    private ChannelName channelName;

    @Enumerated(EnumType.STRING)
    @Column(name = "policy_type", nullable = false, length = 30)
    private CancellationPolicyType policyType;

    @Column(length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cancellation_rules", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> cancellationRules = new ArrayList<>();

    @Column(name = "non_refundable_discount", precision = 5, scale = 2)
    private BigDecimal nonRefundableDiscount;

    @Column(nullable = false)
    private Boolean enabled = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> config = new HashMap<>();

    @Column(name = "synced_at")
    private Instant syncedAt;

    @Column(name = "sync_status", nullable = false, length = 20)
    private String syncStatus = "PENDING";

    @Column(name = "external_policy_id")
    private String externalPolicyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = Instant.now(); }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public ChannelName getChannelName() { return channelName; }
    public void setChannelName(ChannelName channelName) { this.channelName = channelName; }
    public CancellationPolicyType getPolicyType() { return policyType; }
    public void setPolicyType(CancellationPolicyType policyType) { this.policyType = policyType; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<Map<String, Object>> getCancellationRules() { return cancellationRules; }
    public void setCancellationRules(List<Map<String, Object>> cancellationRules) { this.cancellationRules = cancellationRules; }
    public BigDecimal getNonRefundableDiscount() { return nonRefundableDiscount; }
    public void setNonRefundableDiscount(BigDecimal nonRefundableDiscount) { this.nonRefundableDiscount = nonRefundableDiscount; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Map<String, Object> getConfig() { return config; }
    public void setConfig(Map<String, Object> config) { this.config = config; }
    public Instant getSyncedAt() { return syncedAt; }
    public void setSyncedAt(Instant syncedAt) { this.syncedAt = syncedAt; }
    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
    public String getExternalPolicyId() { return externalPolicyId; }
    public void setExternalPolicyId(String externalPolicyId) { this.externalPolicyId = externalPolicyId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
