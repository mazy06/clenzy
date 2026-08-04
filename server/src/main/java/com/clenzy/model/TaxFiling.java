package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Déclaration de taxe de séjour d'un trimestre (vague M-A des modèles métier).
 * Le montant est celui calculé par {@code TouristTaxService.computeForPeriod} au
 * moment de la clôture ; DUE → FILED (dépôt, manuel pour l'instant) → PAID.
 */
@Entity
@Table(name = "tax_filings")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class TaxFiling {

    public enum Status { DUE, FILED, PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /**
     * Logement déclaré. NULL = ligne historique « org, ancien format » : avant la
     * ventilation, une déclaration valait pour toute l organisation — ce qui était
     * faux dès que le portefeuille couvrait plusieurs communes, chacune ayant son
     * barème et son calendrier.
     */
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String currency = "EUR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.DUE;

    @Column(name = "filed_at")
    private Instant filedAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "payment_reference", length = 200)
    private String paymentReference;

    @Column(length = 1000)
    private String notes;

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

    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getFiledAt() { return filedAt; }
    public void setFiledAt(Instant filedAt) { this.filedAt = filedAt; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
