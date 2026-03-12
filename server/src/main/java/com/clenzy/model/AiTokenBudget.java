package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Budget mensuel de tokens par organisation et feature AI.
 * Permet de limiter la consommation LLM par org/feature.
 */
@Entity
@Table(name = "ai_token_budgets", indexes = {
        @Index(name = "idx_ai_token_budgets_org", columnList = "organization_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"organization_id", "feature"})
})
public class AiTokenBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AiFeature feature;

    @Column(name = "monthly_token_limit", nullable = false)
    private long monthlyTokenLimit = 100_000;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Constructors ────────────────────────────────────────────────────

    public AiTokenBudget() {}

    public AiTokenBudget(Long organizationId, AiFeature feature, long monthlyTokenLimit) {
        this.organizationId = organizationId;
        this.feature = feature;
        this.monthlyTokenLimit = monthlyTokenLimit;
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public AiFeature getFeature() { return feature; }
    public void setFeature(AiFeature feature) { this.feature = feature; }

    public long getMonthlyTokenLimit() { return monthlyTokenLimit; }
    public void setMonthlyTokenLimit(long monthlyTokenLimit) { this.monthlyTokenLimit = monthlyTokenLimit; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
