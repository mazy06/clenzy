package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Anomalie terrain (Moteur Ménage, Phase 3C / P10).
 *
 * <p>Signalement de premier ordre remonté du terrain (housekeeper/technicien via
 * le mobile, ou gestionnaire via le web). Cycle de vie :
 * {@code OPEN → QUALIFIED → CONVERTED | DISMISSED}. La conversion crée une
 * {@link ServiceRequest} maintenance pré-chiffrée ({@code estimatedCost} =
 * {@code suggestedCost}) qui entre ensuite dans le flux normal
 * validation/paiement/intervention.</p>
 *
 * <p>Sans lien avec le système {@code Anomaly*} existant (détection IoT capteurs).</p>
 */
@Entity
@Table(name = "issues")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Issue {

    public enum IssueSeverity { LOW, MEDIUM, HIGH, CRITICAL }

    public enum IssueStatus { OPEN, QUALIFIED, CONVERTED, DISMISSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    /** Intervention pendant laquelle l'anomalie a été constatée (NULL hors mission). */
    @Column(name = "source_intervention_id")
    private Long sourceInterventionId;

    /** users.id du signaleur (résolu depuis le JWT — jamais fourni par le client). */
    @Column(name = "reported_by", nullable = false)
    private Long reportedBy;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** Catégorie libre ou alignée sur le catalogue travaux (interventionType/label/domain). */
    @Column(name = "category", length = 80)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    private IssueSeverity severity = IssueSeverity.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 12)
    private IssueStatus status = IssueStatus.OPEN;

    /** Chiffrage suggéré depuis le catalogue travaux (NULL = chiffrage manuel). */
    @Column(name = "suggested_cost", precision = 10, scale = 2)
    private BigDecimal suggestedCost;

    /** ServiceRequest maintenance créée à la conversion. */
    @Column(name = "converted_service_request_id")
    private Long convertedServiceRequestId;

    @Column(name = "dismiss_reason", length = 500)
    private String dismissReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getSourceInterventionId() { return sourceInterventionId; }
    public void setSourceInterventionId(Long sourceInterventionId) { this.sourceInterventionId = sourceInterventionId; }

    public Long getReportedBy() { return reportedBy; }
    public void setReportedBy(Long reportedBy) { this.reportedBy = reportedBy; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public IssueSeverity getSeverity() { return severity; }
    public void setSeverity(IssueSeverity severity) { this.severity = severity; }

    public IssueStatus getStatus() { return status; }
    public void setStatus(IssueStatus status) { this.status = status; }

    public BigDecimal getSuggestedCost() { return suggestedCost; }
    public void setSuggestedCost(BigDecimal suggestedCost) { this.suggestedCost = suggestedCost; }

    public Long getConvertedServiceRequestId() { return convertedServiceRequestId; }
    public void setConvertedServiceRequestId(Long convertedServiceRequestId) { this.convertedServiceRequestId = convertedServiceRequestId; }

    public String getDismissReason() { return dismissReason; }
    public void setDismissReason(String dismissReason) { this.dismissReason = dismissReason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
