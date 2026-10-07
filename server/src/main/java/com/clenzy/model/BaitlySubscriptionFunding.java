package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Dernière preuve canonique des fonds d'une facture ; une restitution n'efface jamais la facture. */
@Entity @Table(name="baitly_subscription_funding")
public class BaitlySubscriptionFunding {
    @Id @Column(name="invoice_id") private String invoiceId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="subscription_id",nullable=false) private String subscriptionId;
    @Column(name="period_end") private Instant periodEnd;
    @Column(name="paid_cents",nullable=false) private long paidCents;
    @Column(name="refunded_cents",nullable=false) private long refundedCents;
    @Column(name="held_cents",nullable=false) private long heldCents;
    @Column(nullable=false) private boolean disputed;
    @Column(name="observed_at",nullable=false) private Instant observedAt;
    protected BaitlySubscriptionFunding() {}
    public BaitlySubscriptionFunding(String invoice,Long org,String sub) {invoiceId=invoice;organizationId=org;subscriptionId=sub;}
    public void observe(long paid,long refunded,long held,boolean risk,Instant end){observe(paid,refunded,held,risk,end,Instant.now());}
    public void observe(long paid,long refunded,long held,boolean risk,Instant end,Instant observed){paidCents=paid;refundedCents=refunded;heldCents=held;disputed=risk;periodEnd=end;observedAt=observed;}
    public Instant getObservedAt(){return observedAt;}
    public String getInvoiceId(){return invoiceId;} public Long getOrganizationId(){return organizationId;} public String getSubscriptionId(){return subscriptionId;}
    public long getPaidCents(){return paidCents;} public long getHeldCents(){return heldCents;} public boolean isDisputed(){return disputed;}
    public boolean blocked(){return disputed || paidCents>0 && heldCents>=paidCents;}
    public long revoked(long granted){return disputed?granted:paidCents==0?0:java.math.BigDecimal.valueOf(granted).multiply(java.math.BigDecimal.valueOf(heldCents)).divide(java.math.BigDecimal.valueOf(paidCents),0,java.math.RoundingMode.CEILING).longValueExact();}
}
