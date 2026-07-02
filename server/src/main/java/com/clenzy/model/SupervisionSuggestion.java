package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Une suggestion ORG-scopée produite par un scan autonome de la constellation.
 *
 * <p>Distincte du HITL user-scopé ({@code PendingToolStore}) : les scans
 * autonomes tournent sans opérateur, leurs propositions doivent atteindre
 * l'org. Informationnelle : l'opérateur lit + agit (ou rejette → DISMISSED).</p>
 */
@Entity
@Table(name = "supervision_suggestion", indexes = {
        @Index(name = "idx_supervision_suggestion_org_prop_status",
                columnList = "organization_id, property_id, status")
})
public class SupervisionSuggestion {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_DISMISSED = "DISMISSED";
    /** Suggestion dont l'action exécutable a été appliquée par l'opérateur. */
    public static final String STATUS_APPLIED = "APPLIED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "module_key", nullable = false, length = 40)
    private String moduleKey;

    @Column(name = "tool_name", length = 120)
    private String toolName;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 500)
    private String motif;

    @Column(name = "reservation_id")
    private Long reservationId;

    /**
     * Type d'action exécutable (ex. {@code PRICE_DROP}) ou {@code null} =
     * informationnelle (l'opérateur lit + rejette, comportement historique).
     */
    @Column(name = "action_type", length = 40)
    private String actionType;

    /** Paramètres de l'action, petit payload JSON (from/to/percent…). */
    @Column(name = "action_params", columnDefinition = "text")
    private String actionParams;

    /** Impact estimé en centimes de la devise de base (EUR), optionnel. */
    @Column(name = "estimated_impact_cents")
    private Long estimatedImpactCents;

    /** Gravité indicative : {@code info} / {@code warning} / {@code critical}. */
    @Column(name = "severity", length = 20)
    private String severity;

    /** Horodatage d'application de l'action (null tant que non appliquée). */
    @Column(name = "applied_at")
    private Instant appliedAt;

    @Column(nullable = false, length = 20)
    private String status = STATUS_PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    public SupervisionSuggestion() {}

    public SupervisionSuggestion(Long organizationId, Long propertyId, String moduleKey,
                                 String toolName, String title, String motif, Instant expiresAt) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.moduleKey = moduleKey;
        this.toolName = toolName;
        this.title = title;
        this.motif = motif;
        this.expiresAt = expiresAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getModuleKey() { return moduleKey; }
    public void setModuleKey(String moduleKey) { this.moduleKey = moduleKey; }

    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMotif() { return motif; }
    public void setMotif(String motif) { this.motif = motif; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getActionParams() { return actionParams; }
    public void setActionParams(String actionParams) { this.actionParams = actionParams; }

    public Long getEstimatedImpactCents() { return estimatedImpactCents; }
    public void setEstimatedImpactCents(Long estimatedImpactCents) { this.estimatedImpactCents = estimatedImpactCents; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public Instant getAppliedAt() { return appliedAt; }
    public void setAppliedAt(Instant appliedAt) { this.appliedAt = appliedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
