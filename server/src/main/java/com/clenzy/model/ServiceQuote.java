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
 * Devis prestataire d'une intervention (M4, vague M-B). Saisi sur la fiche
 * intervention ; la carte {@code QUOTE_APPROVAL} compare les devis RECEIVED et
 * l'approbation (CAS + unique partiel « un seul APPROVED par intervention »)
 * reporte le montant sur {@code intervention.estimatedCost}.
 */
@Entity
@Table(name = "service_quotes")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ServiceQuote {

    public enum Status { RECEIVED, APPROVED, REJECTED, EXPIRED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "intervention_id")
    private Long interventionId;

    @Column(name = "provider_name", nullable = false, length = 200)
    private String providerName;

    /**
     * Intervenant qui a SOUMIS ce devis. {@code null} quand un gestionnaire
     * saisit le devis d'un prestataire externe — le cas historique.
     */
    @Column(name = "provider_user_id")
    private Long providerUserId;

    @Column(name = "provider_email", length = 320)
    private String providerEmail;

    @Column(name = "provider_phone", length = 40)
    private String providerPhone;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String currency = "EUR";

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "earliest_start_date")
    private LocalDate earliestStartDate;

    @Column(length = 1000)
    private String description;

    @Column(name = "document_ref", length = 500)
    private String documentRef;

    /**
     * Detail chiffre, en JSON : [{label, quantity, unitPrice, interventionType}].
     * NULL pour un devis saisi a la main, qui n'a qu'un total.
     */
    @Column(name = "lines", columnDefinition = "TEXT")
    private String lines;

    /**
     * Acompte exigible a la validation. Fige a l'emission : le pourcentage de
     * la plateforme peut changer, un devis deja soumis ne change plus.
     * NULL = pas d'acompte (menage, lingerie, ou taux a zero).
     */
    @Column(name = "deposit_percent")
    private BigDecimal depositPercent;

    @Column(name = "deposit_amount")
    private BigDecimal depositAmount;

    /** Encaissement de l'acompte. NULL tant qu'il n'est pas regle. */
    @Column(name = "deposit_paid_at")
    private java.time.LocalDateTime depositPaidAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.RECEIVED;

    @Column(name = "approved_by", length = 120)
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

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
    public Long getInterventionId() { return interventionId; }
    public void setInterventionId(Long interventionId) { this.interventionId = interventionId; }
    public String getProviderName() { return providerName; }
    public void setProviderName(String providerName) { this.providerName = providerName; }

    public Long getProviderUserId() { return providerUserId; }

    public void setProviderUserId(Long providerUserId) { this.providerUserId = providerUserId; }
    public String getProviderEmail() { return providerEmail; }
    public void setProviderEmail(String providerEmail) { this.providerEmail = providerEmail; }
    public String getProviderPhone() { return providerPhone; }
    public void setProviderPhone(String providerPhone) { this.providerPhone = providerPhone; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }
    public LocalDate getEarliestStartDate() { return earliestStartDate; }
    public void setEarliestStartDate(LocalDate earliestStartDate) { this.earliestStartDate = earliestStartDate; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getDepositPercent() { return depositPercent; }
    public void setDepositPercent(BigDecimal depositPercent) { this.depositPercent = depositPercent; }
    public java.time.LocalDateTime getDepositPaidAt() { return depositPaidAt; }
    public void setDepositPaidAt(java.time.LocalDateTime depositPaidAt) { this.depositPaidAt = depositPaidAt; }
    public BigDecimal getDepositAmount() { return depositAmount; }
    public void setDepositAmount(BigDecimal depositAmount) { this.depositAmount = depositAmount; }
    public String getLines() { return lines; }
    public void setLines(String lines) { this.lines = lines; }
    public String getDocumentRef() { return documentRef; }
    public void setDocumentRef(String documentRef) { this.documentRef = documentRef; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
}
