package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Parametres workflow par organisation.
 * Controle l'auto-assignation, les delais d'annulation, etc.
 */
@Entity
@Table(name = "workflow_settings")
public class WorkflowSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    @Column(name = "auto_assign_interventions", nullable = false)
    private boolean autoAssignInterventions = true;

    @Column(name = "cancellation_deadline_hours", nullable = false)
    private int cancellationDeadlineHours = 24;

    @Column(name = "require_approval_for_changes", nullable = false)
    private boolean requireApprovalForChanges = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public WorkflowSettings() {}

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public boolean isAutoAssignInterventions() { return autoAssignInterventions; }
    public void setAutoAssignInterventions(boolean autoAssignInterventions) { this.autoAssignInterventions = autoAssignInterventions; }

    public int getCancellationDeadlineHours() { return cancellationDeadlineHours; }
    public void setCancellationDeadlineHours(int cancellationDeadlineHours) { this.cancellationDeadlineHours = cancellationDeadlineHours; }

    public boolean isRequireApprovalForChanges() { return requireApprovalForChanges; }
    public void setRequireApprovalForChanges(boolean requireApprovalForChanges) { this.requireApprovalForChanges = requireApprovalForChanges; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
