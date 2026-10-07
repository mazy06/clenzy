package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="baitly_commerce_payouts")
public class BaitlyCommercePayout {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id", nullable=false) private Long organizationId;
    @Column(name="source", nullable=false,length=30) private String source;
    @Column(name="source_id", nullable=false) private Long sourceId;
    @Column(name="party", nullable=false,length=20) private String party;
    @Column(name="beneficiary_user_id", nullable=true) private Long beneficiaryUserId;
    @Column(name="beneficiary_organization_id", nullable=true) private Long beneficiaryOrganizationId;
    @Column(name="request_id", nullable=false) private UUID requestId;
    @Column(name="amount", nullable=false,precision=12,scale=2) private BigDecimal amount;
    @Column(name="currency", nullable=false,length=3) private String currency;
    @Column(name="destination", nullable=false,length=100) private String destination;
    @Column(name="actor", nullable=false,length=255) private String actor;
    @Column(name="created_at", nullable=false) private Instant createdAt=Instant.now();
    @Column(name="cancelled_at") private Instant cancelledAt;
    @Column(name="cancelled_by",length=255) private String cancelledBy;
    public boolean isCancelled(){return cancelledAt!=null;}
    public void cancel(String actor){if(cancelledAt==null){cancelledAt=Instant.now();cancelledBy=actor;}}
    protected BaitlyCommercePayout() {}
    public BaitlyCommercePayout(Long org,String source,Long sourceId,String party,Long user,Long company,UUID request,BigDecimal amount,String currency,String destination,String actor) {
        this.organizationId=org;this.source=source;this.sourceId=sourceId;this.party=party;this.beneficiaryUserId=user;this.beneficiaryOrganizationId=company;
        this.requestId=request;this.amount=amount;this.currency=currency;this.destination=destination;this.actor=actor;
    }
    public Long getId() {return id;}
    public Long getOrganizationId() {return organizationId;}
    public String getSource() {return source;}
    public Long getSourceId() {return sourceId;}
    public String getParty() {return party;}
    public Long getBeneficiaryUserId() {return beneficiaryUserId;}
    public Long getBeneficiaryOrganizationId() {return beneficiaryOrganizationId;}
    public UUID getRequestId() {return requestId;}
    public BigDecimal getAmount() {return amount;}
    public String getCurrency() {return currency;}
    public String getDestination() {return destination;}
    public String getActor() {return actor;}
    public Instant getCreatedAt() {return createdAt;}
}
