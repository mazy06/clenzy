package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Journal d'audit des tentatives d'assignation de demandes de service.
 * Table append-only — pas de @Filter car l'acces se fait toujours via serviceRequestId.
 */
@Entity
@Table(name = "assignment_events")
public class AssignmentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "service_request_id", nullable = false)
    private Long serviceRequestId;

    /**
     * Type d'evenement :
     * AUTO_SUCCESS, AUTO_FAIL, MANUAL_ASSIGN, REFUSE, ESCALATION
     */
    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "assigned_to_type", length = 10)
    private String assignedToType;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public AssignmentEvent() {}

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getServiceRequestId() { return serviceRequestId; }
    public void setServiceRequestId(Long serviceRequestId) { this.serviceRequestId = serviceRequestId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }

    public String getAssignedToType() { return assignedToType; }
    public void setAssignedToType(String assignedToType) { this.assignedToType = assignedToType; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
