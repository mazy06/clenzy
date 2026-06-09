package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "management_contracts")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ManagementContract {

    public enum ContractStatus {
        DRAFT, ACTIVE, SUSPENDED, TERMINATED, EXPIRED
    }

    public enum ContractType {
        FULL_MANAGEMENT,      // Gestion complete (reservations, menage, maintenance)
        BOOKING_ONLY,         // Gestion des reservations uniquement
        MAINTENANCE_ONLY,     // Maintenance et entretien uniquement
        CUSTOM                // Personnalise
    }

    /**
     * Modele de flux des paiements / repartition (taxonomie OTA).
     * DIRECT            : Clenzy encaisse via Stripe -> split escrow owner/concierge/platform.
     * OWNER_COLLECTS    : l'OTA verse au proprietaire -> la conciergerie facture sa commission (creance).
     * CONCIERGE_COLLECTS: l'OTA verse a la conciergerie -> elle reverse le net au proprietaire (Reversement).
     * OTA_COHOST_SPLIT  : l'OTA repartit a la source (co-host payout) -> reconciliation seule.
     */
    public enum PaymentModel {
        DIRECT, OWNER_COLLECTS, CONCIERGE_COLLECTS, OTA_COHOST_SPLIT
    }

    /** Base de calcul de la commission : montant brut, ou net des frais OTA (host fee Airbnb, etc.). */
    public enum CommissionBase {
        GROSS, NET_OF_OTA_FEE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "contract_number", length = 50)
    private String contractNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", nullable = false, length = 30)
    private ContractType contractType = ContractType.FULL_MANAGEMENT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContractStatus status = ContractStatus.DRAFT;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "commission_rate", precision = 5, scale = 4, nullable = false)
    private BigDecimal commissionRate;

    /** Part conciergerie sur les upsells (fraction, après commission plateforme). null = défaut org. */
    @Column(name = "upsell_commission_rate", precision = 5, scale = 4)
    private BigDecimal upsellCommissionRate;

    /** Part conciergerie sur les activités/marketplace (fraction, après commission plateforme). null = défaut org. */
    @Column(name = "activity_commission_rate", precision = 5, scale = 4)
    private BigDecimal activityCommissionRate;

    /** Modèle de flux des paiements / répartition. Défaut DIRECT (comportement Stripe historique). */
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_model", nullable = false, length = 30)
    private PaymentModel paymentModel = PaymentModel.DIRECT;

    /** Base de calcul de la commission (brut, ou net des frais OTA). */
    @Enumerated(EnumType.STRING)
    @Column(name = "commission_base", nullable = false, length = 20)
    private CommissionBase commissionBase = CommissionBase.GROSS;

    @Column(name = "minimum_stay_nights")
    private Integer minimumStayNights;

    @Column(name = "auto_renew")
    private Boolean autoRenew = false;

    @Column(name = "notice_period_days")
    private Integer noticePeriodDays = 30;

    @Column(name = "cleaning_fee_included")
    private Boolean cleaningFeeIncluded = true;

    @Column(name = "maintenance_included")
    private Boolean maintenanceIncluded = true;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "signed_at")
    private Instant signedAt;

    @Column(name = "terminated_at")
    private Instant terminatedAt;

    @Column(name = "termination_reason", columnDefinition = "TEXT")
    private String terminationReason;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (contractNumber == null) {
            contractNumber = "MC-" + System.currentTimeMillis();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getContractNumber() { return contractNumber; }
    public void setContractNumber(String contractNumber) { this.contractNumber = contractNumber; }
    public ContractType getContractType() { return contractType; }
    public void setContractType(ContractType contractType) { this.contractType = contractType; }
    public ContractStatus getStatus() { return status; }
    public void setStatus(ContractStatus status) { this.status = status; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public BigDecimal getCommissionRate() { return commissionRate; }
    public void setCommissionRate(BigDecimal commissionRate) { this.commissionRate = commissionRate; }
    public BigDecimal getUpsellCommissionRate() { return upsellCommissionRate; }
    public void setUpsellCommissionRate(BigDecimal upsellCommissionRate) { this.upsellCommissionRate = upsellCommissionRate; }
    public BigDecimal getActivityCommissionRate() { return activityCommissionRate; }
    public void setActivityCommissionRate(BigDecimal activityCommissionRate) { this.activityCommissionRate = activityCommissionRate; }
    public PaymentModel getPaymentModel() { return paymentModel; }
    public void setPaymentModel(PaymentModel paymentModel) { this.paymentModel = paymentModel; }
    public CommissionBase getCommissionBase() { return commissionBase; }
    public void setCommissionBase(CommissionBase commissionBase) { this.commissionBase = commissionBase; }
    public Integer getMinimumStayNights() { return minimumStayNights; }
    public void setMinimumStayNights(Integer minimumStayNights) { this.minimumStayNights = minimumStayNights; }
    public Boolean getAutoRenew() { return autoRenew; }
    public void setAutoRenew(Boolean autoRenew) { this.autoRenew = autoRenew; }
    public Integer getNoticePeriodDays() { return noticePeriodDays; }
    public void setNoticePeriodDays(Integer noticePeriodDays) { this.noticePeriodDays = noticePeriodDays; }
    public Boolean getCleaningFeeIncluded() { return cleaningFeeIncluded; }
    public void setCleaningFeeIncluded(Boolean cleaningFeeIncluded) { this.cleaningFeeIncluded = cleaningFeeIncluded; }
    public Boolean getMaintenanceIncluded() { return maintenanceIncluded; }
    public void setMaintenanceIncluded(Boolean maintenanceIncluded) { this.maintenanceIncluded = maintenanceIncluded; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }
    public Instant getTerminatedAt() { return terminatedAt; }
    public void setTerminatedAt(Instant terminatedAt) { this.terminatedAt = terminatedAt; }
    public String getTerminationReason() { return terminationReason; }
    public void setTerminationReason(String terminationReason) { this.terminationReason = terminationReason; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
