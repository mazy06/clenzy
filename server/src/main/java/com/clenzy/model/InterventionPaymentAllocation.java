package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Part figée d'un encaissement groupé Baitly, créée avant l'appel au PSP. */
@Entity
@Table(name = "intervention_payment_allocations", uniqueConstraints =
        @UniqueConstraint(name = "uq_intervention_payment_allocation", columnNames = {"transaction_id", "intervention_id"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class InterventionPaymentAllocation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private Long organizationId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false, updatable = false)
    private PaymentTransaction transaction;
    @Column(name = "intervention_id", nullable = false, updatable = false)
    private Long interventionId;
    @Column(nullable = false, precision = 12, scale = 2, updatable = false)
    private BigDecimal amount;
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;
    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    protected InterventionPaymentAllocation() {}
    public InterventionPaymentAllocation(PaymentTransaction transaction, Long interventionId, BigDecimal amount) {
        this.transaction = transaction;
        this.organizationId = transaction.getOrganizationId();
        this.interventionId = interventionId;
        this.amount = amount.setScale(2, java.math.RoundingMode.UNNECESSARY);
        this.currency = transaction.getCurrency();
        if (this.amount.signum() <= 0) throw new IllegalArgumentException("Part de paiement positive requise");
    }
    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public PaymentTransaction getTransaction() { return transaction; }
    public Long getInterventionId() { return interventionId; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void confirm() { if (confirmedAt == null) confirmedAt = LocalDateTime.now(); }
}
