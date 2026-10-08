package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Période prépayée prouvée par une facture PSP, jamais déduite d'un simple identifiant d'abonnement. */
@Entity @Table(name="baitly_ai_credit_coverage")
public class BaitlyCreditCoverage {
    @Id @Column(name="invoice_id",length=255) private String invoiceId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="subscription_id",nullable=false,length=255) private String subscriptionId;
    @Column(name="period_start",nullable=false) private Instant periodStart;
    @Column(name="period_end",nullable=false) private Instant periodEnd;
    @Column(nullable=false) private boolean blocked;
    protected BaitlyCreditCoverage() {}
    public BaitlyCreditCoverage(String invoice,Long org,String subscription,Instant start,Instant end) {
        invoiceId=invoice;organizationId=org;subscriptionId=subscription;periodStart=start;periodEnd=end;
    }
    public Long getOrganizationId(){return organizationId;}
    public String getSubscriptionId(){return subscriptionId;}
    public Instant getPeriodStart(){return periodStart;}
    public Instant getPeriodEnd(){return periodEnd;}
    public String getInvoiceId(){return invoiceId;}
    public boolean isBlocked(){return blocked;}
    public void setBlocked(boolean value){blocked=value;}
}
