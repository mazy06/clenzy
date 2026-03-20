package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Incident P1 pour le suivi de la fiabilite du systeme.
 *
 * Utilise par IncidentDetectionScheduler pour la detection automatique
 * et par KpiService pour le calcul du temps moyen de resolution P1.
 *
 * PAS de @Filter("organizationFilter") : cross-org, comme KpiSnapshot.
 */
@Entity
@Table(name = "incidents")
public class Incident {

    public enum IncidentType {
        SERVICE_DOWN,
        DOUBLE_BOOKING,
        CRITICAL_KPI_FAILURE,
        SYNC_UNAVAILABLE
    }

    public enum IncidentSeverity {
        P1, P2, P3
    }

    public enum IncidentStatus {
        OPEN, ACKNOWLEDGED, RESOLVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 50)
    private IncidentType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    private IncidentSeverity severity = IncidentSeverity.P1;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private IncidentStatus status = IncidentStatus.OPEN;

    @Column(name = "service_name", length = 100)
    private String serviceName;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "opened_at", nullable = false)
    private LocalDateTime openedAt = LocalDateTime.now();

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_minutes", precision = 8, scale = 2)
    private BigDecimal resolutionMinutes;

    @Column(name = "auto_detected", nullable = false)
    private boolean autoDetected = true;

    @Column(name = "auto_resolved", nullable = false)
    private boolean autoResolved = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Incident() {}

    // Getters and setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public IncidentType getType() { return type; }
    public void setType(IncidentType type) { this.type = type; }

    public IncidentSeverity getSeverity() { return severity; }
    public void setSeverity(IncidentSeverity severity) { this.severity = severity; }

    public IncidentStatus getStatus() { return status; }
    public void setStatus(IncidentStatus status) { this.status = status; }

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getOpenedAt() { return openedAt; }
    public void setOpenedAt(LocalDateTime openedAt) { this.openedAt = openedAt; }

    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public BigDecimal getResolutionMinutes() { return resolutionMinutes; }
    public void setResolutionMinutes(BigDecimal resolutionMinutes) { this.resolutionMinutes = resolutionMinutes; }

    public boolean isAutoDetected() { return autoDetected; }
    public void setAutoDetected(boolean autoDetected) { this.autoDetected = autoDetected; }

    public boolean isAutoResolved() { return autoResolved; }
    public void setAutoResolved(boolean autoResolved) { this.autoResolved = autoResolved; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "Incident{id=" + id + ", type=" + type + ", severity=" + severity
                + ", status=" + status + ", serviceName='" + serviceName + "'"
                + ", title='" + title + "', openedAt=" + openedAt + "}";
    }
}
