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

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
