package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Litige bancaire (dispute Stripe) — vague M-B des modèles métier. Créé par le
 * webhook {@code dispute.created}, les preuves sont assemblées depuis NOS données
 * et déposées via l'API ({@code CHARGEBACK_SUBMIT}), l'issue vient du webhook
 * {@code dispute.closed}.
 */
@Entity
@Table(name = "payment_disputes")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PaymentDispute {

    public enum Status { OPEN, SUBMITTED, WON, LOST }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "provider_dispute_id", nullable = false, length = 120, unique = true)
    private String providerDisputeId;

    @Column(name = "charge_id", length = 120)
    private String chargeId;

    @Column(name = "reservation_id")
    private Long reservationId;

    private BigDecimal amount;

    @Column(length = 8)
    private String currency;

    @Column(name = "due_by")
    private Instant dueBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(name = "evidence_submitted_at")
    private Instant evidenceSubmittedAt;

    @Column(length = 40)
    private String outcome;

    @Column(name = "outcome_at")
    private Instant outcomeAt;

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
    public String getProviderDisputeId() { return providerDisputeId; }
    public void setProviderDisputeId(String providerDisputeId) { this.providerDisputeId = providerDisputeId; }
    public String getChargeId() { return chargeId; }
    public void setChargeId(String chargeId) { this.chargeId = chargeId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Instant getDueBy() { return dueBy; }
    public void setDueBy(Instant dueBy) { this.dueBy = dueBy; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getEvidenceSubmittedAt() { return evidenceSubmittedAt; }
    public void setEvidenceSubmittedAt(Instant evidenceSubmittedAt) { this.evidenceSubmittedAt = evidenceSubmittedAt; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }
    public Instant getOutcomeAt() { return outcomeAt; }
    public void setOutcomeAt(Instant outcomeAt) { this.outcomeAt = outcomeAt; }
}
