package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Taux de monétisation par organisation : part plateforme sur les upsells et part
 * hôte sur les commissions d'activités. Valeurs nullables = on retombe sur les
 * défauts globaux ({@code UpsellConfig} / {@code ActivityCommissionConfig}).
 * Une ligne par org.
 */
@Entity
@Table(name = "org_monetization_config", indexes = {
        @Index(name = "idx_org_monetization_org", columnList = "organization_id", unique = true)
})
public class OrgMonetizationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    /** Part plateforme (%) sur les upsells. Null = défaut global. */
    @Column(name = "upsell_platform_fee_pct", precision = 5, scale = 2)
    private BigDecimal upsellPlatformFeePct;

    /** Part hôte (%) sur les commissions d'activités. Null = défaut global. */
    @Column(name = "activity_host_share_pct", precision = 5, scale = 2)
    private BigDecimal activityHostSharePct;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public BigDecimal getUpsellPlatformFeePct() { return upsellPlatformFeePct; }
    public void setUpsellPlatformFeePct(BigDecimal upsellPlatformFeePct) { this.upsellPlatformFeePct = upsellPlatformFeePct; }
    public BigDecimal getActivityHostSharePct() { return activityHostSharePct; }
    public void setActivityHostSharePct(BigDecimal activityHostSharePct) { this.activityHostSharePct = activityHostSharePct; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
