package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import java.math.BigDecimal;
import java.time.Instant;

/** Une créance de récupération distincte du remboursement client et du transfert historique. */
@Entity
@Table(name = "baitly_transfer_recoveries", uniqueConstraints = @UniqueConstraint(columnNames = {"transfer_id", "refund_id"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class BaitlyTransferRecovery {
    public enum State { WAITING_REFUND, RECOVERING, RECOVERED, NO_RECOVERY_REQUIRED, REVIEW_REQUIRED, CANCELLED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "organization_id", nullable = false, updatable = false) private Long organizationId;
    @Column(name = "transfer_id", nullable = false, updatable = false) private Long transferId;
    @Column(name = "refund_id", nullable = false, updatable = false) private Long refundId;
    @Column(nullable = false, updatable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(name = "commission_refund_amount", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal commissionRefundAmount;
    @Column(name = "gross_basis", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal grossBasis;
    @Column(name = "net_basis", updatable = false, precision = 12, scale = 2)
    private BigDecimal netBasis;
    @Column(nullable = false, updatable = false, length = 3) private String currency;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private State state;
    @Column(name = "reversal_reference", unique = true) private String reversalReference;
    @Column(name = "failure_code", length = 80) private String failureCode;
    @Column(name = "first_attempt_at") private Instant firstAttemptAt;
    @Column(name = "next_attempt_at", nullable = false) private Instant nextAttemptAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected BaitlyTransferRecovery() {}
    public BaitlyTransferRecovery(PayoutTransfer transfer, PaymentTransaction refund, BigDecimal recoveryAmount, BigDecimal grossBasis) {
        this(transfer,refund,recoveryAmount,grossBasis,transfer.getAmount());
    }
    public BaitlyTransferRecovery(PayoutTransfer transfer, PaymentTransaction refund, BigDecimal recoveryAmount, BigDecimal grossBasis,BigDecimal netBasis) {
        if (recoveryAmount == null || recoveryAmount.signum() < 0 || recoveryAmount.scale() > 2
                || grossBasis == null || grossBasis.scale() > 2 || netBasis==null || netBasis.signum()<0
                || grossBasis.compareTo(netBasis) < 0 || netBasis.compareTo(transfer.getAmount())>0
                || refund.getAmount().signum() <= 0 || refund.getAmount().scale() > 2 || refund.getAmount().compareTo(grossBasis) > 0
                || recoveryAmount.compareTo(transfer.getAmount()) > 0 || recoveryAmount.compareTo(refund.getAmount()) > 0)
            throw new IllegalArgumentException("Montant de récupération hors budget");
        organizationId = transfer.getOrganizationId(); transferId = transfer.getId(); refundId = refund.getId();
        amount = recoveryAmount; currency = transfer.getCurrency(); state = State.WAITING_REFUND;
        commissionRefundAmount = refund.getAmount().subtract(recoveryAmount); this.grossBasis = grossBasis;
        this.netBasis=netBasis;
        createdAt = updatedAt = nextAttemptAt = Instant.now();
    }
    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public Long getTransferId() { return transferId; }
    public Long getRefundId() { return refundId; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getCommissionRefundAmount() { return commissionRefundAmount; }
    public BigDecimal getGrossBasis() { return grossBasis; }
    public BigDecimal getNetBasis() { return netBasis; }
    public String getCurrency() { return currency; }
    public State getState() { return state; }
    public String getReversalReference() { return reversalReference; }
    public String getFailureCode() { return failureCode; }
    public Instant getFirstAttemptAt() { return firstAttemptAt; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public boolean isTerminal() { return state == State.RECOVERED || state == State.NO_RECOVERY_REQUIRED || state == State.CANCELLED; }
    public void claim(Instant now) {
        if (isTerminal() || amount.signum() == 0) throw new IllegalStateException("Aucune récupération à lancer");
        if (firstAttemptAt == null) firstAttemptAt = now;
        state = State.RECOVERING; updatedAt = now; nextAttemptAt = now.plusSeconds(120);
    }
    public void confirm(String reference) {
        if (reference == null || !reference.startsWith("trr_") || state == State.CANCELLED || amount.signum() == 0
                || (reversalReference != null && !reversalReference.equals(reference)))
            throw new IllegalStateException("Preuve de récupération incompatible");
        reversalReference = reference; state = State.RECOVERED; failureCode = null; updatedAt = Instant.now();
    }
    /** Appelé uniquement après rapprochement du remboursement client ; aucun mouvement prestataire. */
    public void confirmWithoutRecovery() {
        if (amount.signum() != 0 || state == State.CANCELLED || firstAttemptAt != null || reversalReference != null)
            throw new IllegalStateException("Une récupération prestataire reste nécessaire");
        state = State.NO_RECOVERY_REQUIRED; failureCode = null; updatedAt = Instant.now();
    }
    public void review(String code) {
        if (isTerminal()) return;
        state = State.REVIEW_REQUIRED; failureCode = code; updatedAt = Instant.now();
        nextAttemptAt = updatedAt.plusSeconds(600);
    }
    public void cancel() {
        if (firstAttemptAt != null || state == State.NO_RECOVERY_REQUIRED || state == State.RECOVERED)
            throw new IllegalStateException("Récupération déjà engagée");
        state = State.CANCELLED; updatedAt = Instant.now();
    }
}
