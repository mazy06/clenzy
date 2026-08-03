package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Demande RGPD d'un voyageur — vague M-C des modèles métier (M9). Saisie
 * v1 par l'admin (Réglages > Confidentialité), échéance légale J+30 portée
 * par {@code dueAt}. L'effacement ({@code executeErasure}) est SÉLECTIF :
 * PII purgées, données à obligation légale conservées avec base tracée dans
 * {@code report}.
 */
@Entity
@Table(name = "privacy_requests")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PrivacyRequest {

    public enum Type { ERASURE, ACCESS, RECTIFICATION }

    public enum Status { RECEIVED, IN_PROGRESS, COMPLETED, REFUSED }

    /** Délai légal de réponse RGPD (article 12.3) : un mois. */
    public static final int LEGAL_DUE_DAYS = 30;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "guest_id")
    private Long guestId;

    @Column(name = "requester_email", nullable = false, length = 320)
    private String requesterEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type = Type.ERASURE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.RECEIVED;

    @Column(name = "requested_at", nullable = false)
    private LocalDate requestedAt;

    @Column(name = "due_at", nullable = false)
    private LocalDate dueAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "handled_by", length = 120)
    private String handledBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String report;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getGuestId() { return guestId; }
    public void setGuestId(Long guestId) { this.guestId = guestId; }
    public String getRequesterEmail() { return requesterEmail; }
    public void setRequesterEmail(String requesterEmail) { this.requesterEmail = requesterEmail; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public LocalDate getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDate requestedAt) { this.requestedAt = requestedAt; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public String getHandledBy() { return handledBy; }
    public void setHandledBy(String handledBy) { this.handledBy = handledBy; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getReport() { return report; }
    public void setReport(String report) { this.report = report; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
