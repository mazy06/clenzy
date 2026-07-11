package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Versement d'un prestataire ménage pour UNE intervention (Moteur Ménage 3B — P9).
 *
 * <p>Money-path : la contrainte UNIQUE(intervention_id) est le verrou
 * anti-double-payout (check-then-act interdit — audit règle 8) ; les transitions
 * de statut se font par UPDATE conditionnel (CAS) dans le repository ; le
 * transfert Stripe part APRÈS COMMIT, jamais dans une transaction DB.</p>
 */
@Entity
@Table(name = "housekeeper_payout_records",
       uniqueConstraints = @UniqueConstraint(name = "housekeeper_payout_records_intervention_unique",
                                             columnNames = {"intervention_id"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class HousekeeperPayoutRecord {

    public enum Status { PENDING, SENT, FAILED, BLOCKED }

    /** Raison d'un statut BLOCKED / FAILED (jamais silencieux). */
    public static final String REASON_PROOF_MISSING = "PROOF_MISSING";
    public static final String REASON_ONBOARDING_INCOMPLETE = "ONBOARDING_INCOMPLETE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "intervention_id", nullable = false)
    private Long interventionId;

    /** Montant NET versé au pro (rémunération − commission). */
    @Column(name = "amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "commission_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    @Column(name = "stripe_transfer_id", length = 64)
    private String stripeTransferId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private Status status;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public HousekeeperPayoutRecord() {
    }

    public HousekeeperPayoutRecord(Long organizationId, Long userId, Long interventionId,
                                   BigDecimal amount, BigDecimal commissionAmount, Status status) {
        this.organizationId = organizationId;
        this.userId = userId;
        this.interventionId = interventionId;
        this.amount = amount;
        this.commissionAmount = commissionAmount;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getInterventionId() { return interventionId; }
    public void setInterventionId(Long interventionId) { this.interventionId = interventionId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public BigDecimal getCommissionAmount() { return commissionAmount; }
    public void setCommissionAmount(BigDecimal commissionAmount) { this.commissionAmount = commissionAmount; }

    public String getStripeTransferId() { return stripeTransferId; }
    public void setStripeTransferId(String stripeTransferId) { this.stripeTransferId = stripeTransferId; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
