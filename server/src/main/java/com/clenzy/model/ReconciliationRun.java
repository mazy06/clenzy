package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Resultat d'un run de reconciliation calendrier.
 * Compare le calendrier PMS (source de verite) avec le calendrier
 * cote channel pour un mapping property-channel donne.
 *
 * PAS de @Filter("organizationFilter") : consultable cross-org par SUPER_ADMIN.
 */
@Entity
@Table(name = "reconciliation_runs")
public class ReconciliationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel", nullable = false, length = 30)
    private String channel;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /** RUNNING, SUCCESS, FAILED, DIVERGENCE */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "RUNNING";

    @Column(name = "pms_days_checked", nullable = false)
    private int pmsDaysChecked = 0;

    @Column(name = "channel_days_checked", nullable = false)
    private int channelDaysChecked = 0;

    @Column(name = "discrepancies_found", nullable = false)
    private int discrepanciesFound = 0;

    @Column(name = "discrepancies_fixed", nullable = false)
    private int discrepanciesFixed = 0;

    @Column(name = "divergence_pct", precision = 5, scale = 2)
    private BigDecimal divergencePct = BigDecimal.ZERO;

    @Column(name = "details", columnDefinition = "JSONB")
    private String details;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    // Constructeurs

    public ReconciliationRun() {}

    public ReconciliationRun(String channel, Long propertyId, Long organizationId) {
        this.channel = channel;
        this.propertyId = propertyId;
        this.organizationId = organizationId;
        this.startedAt = LocalDateTime.now();
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getPmsDaysChecked() { return pmsDaysChecked; }
    public void setPmsDaysChecked(int pmsDaysChecked) { this.pmsDaysChecked = pmsDaysChecked; }

    public int getChannelDaysChecked() { return channelDaysChecked; }
    public void setChannelDaysChecked(int channelDaysChecked) { this.channelDaysChecked = channelDaysChecked; }

    public int getDiscrepanciesFound() { return discrepanciesFound; }
    public void setDiscrepanciesFound(int discrepanciesFound) { this.discrepanciesFound = discrepanciesFound; }

    public int getDiscrepanciesFixed() { return discrepanciesFixed; }
    public void setDiscrepanciesFixed(int discrepanciesFixed) { this.discrepanciesFixed = discrepanciesFixed; }

    public BigDecimal getDivergencePct() { return divergencePct; }
    public void setDivergencePct(BigDecimal divergencePct) { this.divergencePct = divergencePct; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    @Override
    public String toString() {
        return "ReconciliationRun{id=" + id + ", channel='" + channel + "'"
                + ", propertyId=" + propertyId + ", status='" + status + "'"
                + ", discrepancies=" + discrepanciesFound + "/" + discrepanciesFixed + "}";
    }
}
