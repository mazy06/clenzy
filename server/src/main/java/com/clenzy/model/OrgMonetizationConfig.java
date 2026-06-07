package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Taux de monétisation par organisation, sur deux niveaux d'accès :
 *
 * <ul>
 *   <li><b>Commission plateforme</b> (ce que Clenzy prélève) — réglable UNIQUEMENT par
 *       le staff plateforme : {@code upsellPlatformFeePct}, {@code activityPlatformCommissionPct}.</li>
 *   <li><b>Commission de l'org</b> (part conciergerie sur le reste après plateforme) —
 *       réglable par l'org/host : {@code upsellOrgCommissionPct}, {@code activityOrgCommissionPct}.</li>
 * </ul>
 *
 * <p>Valeurs nullables = défaut global. Une ligne par org. L'hôte (propriétaire) reçoit
 * le solde après plateforme et conciergerie.</p>
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

    // ─── Commission plateforme (staff-only) ──────────────────────────────────
    /** Part plateforme (%) sur les upsells. Null = défaut global. */
    @Column(name = "upsell_platform_fee_pct", precision = 5, scale = 2)
    private BigDecimal upsellPlatformFeePct;

    /** Commission plateforme (%) sur les activités. Null = défaut global. */
    @Column(name = "activity_platform_commission_pct", precision = 5, scale = 2)
    private BigDecimal activityPlatformCommissionPct;

    // ─── Commission org / conciergerie (org-editable) ────────────────────────
    /** Part org/conciergerie (%) sur le reste des upsells après plateforme. Null = 0. */
    @Column(name = "upsell_org_commission_pct", precision = 5, scale = 2)
    private BigDecimal upsellOrgCommissionPct;

    /** Part org/conciergerie (%) sur le reste des commissions d'activités après plateforme. Null = 0. */
    @Column(name = "activity_org_commission_pct", precision = 5, scale = 2)
    private BigDecimal activityOrgCommissionPct;

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
    public void setUpsellPlatformFeePct(BigDecimal v) { this.upsellPlatformFeePct = v; }
    public BigDecimal getActivityPlatformCommissionPct() { return activityPlatformCommissionPct; }
    public void setActivityPlatformCommissionPct(BigDecimal v) { this.activityPlatformCommissionPct = v; }
    public BigDecimal getUpsellOrgCommissionPct() { return upsellOrgCommissionPct; }
    public void setUpsellOrgCommissionPct(BigDecimal v) { this.upsellOrgCommissionPct = v; }
    public BigDecimal getActivityOrgCommissionPct() { return activityOrgCommissionPct; }
    public void setActivityOrgCommissionPct(BigDecimal v) { this.activityOrgCommissionPct = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
