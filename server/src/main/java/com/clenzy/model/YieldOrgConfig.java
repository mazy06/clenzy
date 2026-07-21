package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Configuration yield v1 par organisation (F8a).
 *
 * <p>Porte le kill-switch global ({@code enabled}, défaut OFF : le scheduler
 * ignore l'org tant qu'il n'est pas activé explicitement) et le mode
 * progressif {@link YieldMode} (défaut SIMULATION). Le mode est PAR ORG —
 * un seul cadran de confiance, pas un mode par règle.</p>
 */
@Entity
@Table(name = "yield_org_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class YieldOrgConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Kill-switch org : false = le moteur yield ne touche à RIEN pour cette org. */
    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20, nullable = false)
    private YieldMode mode = YieldMode.SIMULATION;

    // ── RMS R2 : automatisations déterministes (opt-in, réversibles) ────────

    /** Orphan gap pricing : remise + min-stay abaissé sur les creux courts entre deux résas. */
    @Column(name = "orphan_gap_enabled", nullable = false)
    private boolean orphanGapEnabled = false;

    /** Longueur max (nuits) d'un creux traité comme orphelin. */
    @Column(name = "orphan_gap_max_nights", nullable = false)
    private int orphanGapMaxNights = 3;

    /** Remise appliquée aux nuits orphelines (bornée par le floor du bien). */
    @Column(name = "orphan_gap_discount_pct", nullable = false)
    private java.math.BigDecimal orphanGapDiscountPct = java.math.BigDecimal.valueOf(15);

    /** Min-stay dynamique : réduction last-minute du séjour minimum. */
    @Column(name = "min_stay_auto_enabled", nullable = false)
    private boolean minStayAutoEnabled = false;

    /** Fenêtre (jours avant la nuit) dans laquelle le min-stay est réduit. */
    @Column(name = "min_stay_reduce_within_days", nullable = false)
    private int minStayReduceWithinDays = 14;

    /** Valeur réduite du min-stay dans la fenêtre. */
    @Column(name = "min_stay_reduced_value", nullable = false)
    private int minStayReducedValue = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private Instant updatedAt;

    public YieldOrgConfig() {}

    public YieldOrgConfig(Long organizationId) {
        this.organizationId = organizationId;
    }

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public YieldMode getMode() { return mode; }
    public void setMode(YieldMode mode) { this.mode = mode; }

    public boolean isOrphanGapEnabled() { return orphanGapEnabled; }
    public void setOrphanGapEnabled(boolean orphanGapEnabled) { this.orphanGapEnabled = orphanGapEnabled; }

    public int getOrphanGapMaxNights() { return orphanGapMaxNights; }
    public void setOrphanGapMaxNights(int orphanGapMaxNights) { this.orphanGapMaxNights = orphanGapMaxNights; }

    public java.math.BigDecimal getOrphanGapDiscountPct() { return orphanGapDiscountPct; }
    public void setOrphanGapDiscountPct(java.math.BigDecimal orphanGapDiscountPct) { this.orphanGapDiscountPct = orphanGapDiscountPct; }

    public boolean isMinStayAutoEnabled() { return minStayAutoEnabled; }
    public void setMinStayAutoEnabled(boolean minStayAutoEnabled) { this.minStayAutoEnabled = minStayAutoEnabled; }

    public int getMinStayReduceWithinDays() { return minStayReduceWithinDays; }
    public void setMinStayReduceWithinDays(int minStayReduceWithinDays) { this.minStayReduceWithinDays = minStayReduceWithinDays; }

    public int getMinStayReducedValue() { return minStayReducedValue; }
    public void setMinStayReducedValue(int minStayReducedValue) { this.minStayReducedValue = minStayReducedValue; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
