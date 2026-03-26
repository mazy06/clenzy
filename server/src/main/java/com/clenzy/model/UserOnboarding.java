package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_onboarding",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "role", "step_key"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class UserOnboarding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    private UserRole role;

    @Column(name = "step_key", nullable = false, length = 50)
    private String stepKey;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(nullable = false)
    private boolean dismissed;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected UserOnboarding() {}

    public UserOnboarding(Long userId, UserRole role, String stepKey, Long organizationId) {
        this.userId = userId;
        this.role = role;
        this.stepKey = stepKey;
        this.organizationId = organizationId;
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }

    public Long getUserId() { return userId; }

    public UserRole getRole() { return role; }

    public String getStepKey() { return stepKey; }

    public boolean isCompleted() { return completed; }

    public void markCompleted() {
        this.completed = true;
        this.completedAt = Instant.now();
    }

    public void markUncompleted() {
        this.completed = false;
        this.completedAt = null;
    }

    public Instant getCompletedAt() { return completedAt; }

    public boolean isDismissed() { return dismissed; }

    public void setDismissed(boolean dismissed) { this.dismissed = dismissed; }

    public Long getOrganizationId() { return organizationId; }

    public Instant getCreatedAt() { return createdAt; }
}
