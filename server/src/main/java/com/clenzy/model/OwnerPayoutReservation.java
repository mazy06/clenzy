package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;

/** Attribution durable d'un séjour à un seul reversement, avec ses preuves d'encaissement. */
@Entity
@Table(name = "owner_payout_reservations", uniqueConstraints =
        @UniqueConstraint(name = "uq_owner_payout_reservation", columnNames = "reservation_id"))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OwnerPayoutReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "reservation_id", nullable = false, updatable = false)
    private Long reservationId;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private Long organizationId;
    @Column(name = "payout_id", nullable = false, updatable = false)
    private Long payoutId;
    @Column(name = "collected_amount", nullable = false, precision = 12, scale = 2, updatable = false)
    private BigDecimal collectedAmount;
    @Column(name = "net_amount", precision = 12, scale = 2, updatable = false)
    private BigDecimal netAmount;
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payment_transaction_ids", nullable = false, columnDefinition = "jsonb", updatable = false)
    private List<Long> paymentTransactionIds;

    protected OwnerPayoutReservation() {}

    public OwnerPayoutReservation(Long reservationId, Long organizationId, Long payoutId,
                                 BigDecimal collectedAmount, String currency, List<Long> paymentTransactionIds) {
        this.reservationId = reservationId;
        this.organizationId = organizationId;
        this.payoutId = payoutId;
        this.collectedAmount = collectedAmount;
        this.currency = currency;
        this.paymentTransactionIds = List.copyOf(paymentTransactionIds);
    }

    public Long getReservationId() { return reservationId; }
    public Long getOrganizationId() { return organizationId; }
    public Long getPayoutId() { return payoutId; }
    public BigDecimal getCollectedAmount() { return collectedAmount; }
    public BigDecimal getNetAmount() { return netAmount; }
    public void setNetAmount(BigDecimal value) {
        if(netAmount!=null || value==null || value.signum()<0 || value.compareTo(collectedAmount)>0)
            throw new IllegalArgumentException("Part nette du séjour incohérente ou déjà figée");
        netAmount=value;
    }
    public String getCurrency() { return currency; }
    public List<Long> getPaymentTransactionIds() { return paymentTransactionIds; }
}
