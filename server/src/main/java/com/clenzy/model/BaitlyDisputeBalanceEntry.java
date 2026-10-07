package com.clenzy.model;

import com.clenzy.service.BaitlyDisputeProof;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import java.math.BigDecimal;
import java.time.Instant;

/** Mouvement PSP exact, distinct des répartitions internes et sans solde bancaire inventé. */
@Entity
@Table(name="baitly_dispute_balance_entries")
@Filter(name="organizationFilter",condition="organization_id = :orgId")
public class BaitlyDisputeBalanceEntry {
    @Id @Column(name="provider_reference",length=120) private String reference;
    @Column(name="organization_id",nullable=false,updatable=false) private Long organizationId;
    @Column(name="payment_transaction_id",nullable=false,updatable=false) private Long paymentId;
    @Column(name="provider_dispute_id",nullable=false,updatable=false,length=120) private String disputeId;
    @Column(nullable=false,updatable=false,precision=12,scale=2) private BigDecimal amount;
    @Column(nullable=false,updatable=false,precision=12,scale=2) private BigDecimal fee;
    @Column(nullable=false,updatable=false,precision=12,scale=2) private BigDecimal net;
    @Column(nullable=false,updatable=false,length=3) private String currency;
    @Column(name="created_at",nullable=false,updatable=false) private Instant created;
    @Column(name="available_at",nullable=false,updatable=false) private Instant available;
    protected BaitlyDisputeBalanceEntry() {}
    public BaitlyDisputeBalanceEntry(BaitlyDisputeProof proof,BaitlyDisputeProof.Movement movement) {
        reference=movement.reference(); organizationId=proof.org(); paymentId=proof.paymentId(); disputeId=proof.dispute();
        amount=movement.amount(); fee=movement.fee(); net=movement.net(); currency=movement.currency();
        created=movement.created(); available=movement.available();
    }
    public boolean matches(BaitlyDisputeProof proof,BaitlyDisputeProof.Movement movement) {
        return java.util.Objects.equals(organizationId,proof.org()) && java.util.Objects.equals(paymentId,proof.paymentId())
            && java.util.Objects.equals(disputeId,proof.dispute()) && java.util.Objects.equals(reference,movement.reference())
            && amount.compareTo(movement.amount())==0 && fee.compareTo(movement.fee())==0 && net.compareTo(movement.net())==0
            && currency.equals(movement.currency()) && created.equals(movement.created()) && available.equals(movement.available());
    }
}
