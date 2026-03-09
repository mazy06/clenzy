package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "split_configurations", indexes = {
    @Index(name = "idx_split_config_org", columnList = "organization_id")
})
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class SplitConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;

    @NotNull
    @Column(name = "owner_share", nullable = false, precision = 5, scale = 4)
    private BigDecimal ownerShare = new BigDecimal("0.8000");

    @NotNull
    @Column(name = "platform_share", nullable = false, precision = 5, scale = 4)
    private BigDecimal platformShare = new BigDecimal("0.0500");

    @NotNull
    @Column(name = "concierge_share", nullable = false, precision = 5, scale = 4)
    private BigDecimal conciergeShare = new BigDecimal("0.1500");

    @Column(name = "is_default")
    private Boolean isDefault = false;

    @Column(name = "active")
    private Boolean active = true;

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

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getOwnerShare() { return ownerShare; }
    public void setOwnerShare(BigDecimal ownerShare) { this.ownerShare = ownerShare; }
    public BigDecimal getPlatformShare() { return platformShare; }
    public void setPlatformShare(BigDecimal platformShare) { this.platformShare = platformShare; }
    public BigDecimal getConciergeShare() { return conciergeShare; }
    public void setConciergeShare(BigDecimal conciergeShare) { this.conciergeShare = conciergeShare; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
