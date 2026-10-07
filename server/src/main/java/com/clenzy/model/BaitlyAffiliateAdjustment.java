package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Correction append-only du rapport partenaire, avec preuve et bases originales conservées. */
@Entity @Table(name="baitly_affiliate_adjustments",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","request_id"}))
public class BaitlyAffiliateAdjustment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="commission_id",nullable=false) private Long commissionId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(name="basis_gross",nullable=false,precision=12,scale=2) private BigDecimal basisGross;
    @Column(name="basis_host",nullable=false,precision=12,scale=2) private BigDecimal basisHost;
    @Column(name="before_gross",nullable=false,precision=12,scale=2) private BigDecimal beforeGross;
    @Column(name="after_gross",nullable=false,precision=12,scale=2) private BigDecimal afterGross;
    @Column(name="before_host",nullable=false,precision=12,scale=2) private BigDecimal beforeHost;
    @Column(name="after_host",nullable=false,precision=12,scale=2) private BigDecimal afterHost;
    @Column(nullable=false,length=3) private String currency;
    @Column(nullable=false,length=255) private String proof;
    @Column(nullable=false,length=1000) private String reason;
    @Column(nullable=false,length=255) private String actor;
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyAffiliateAdjustment() {}
    public BaitlyAffiliateAdjustment(ActivityCommission row,UUID request,BigDecimal basis,BigDecimal hostBasis,BigDecimal gross,BigDecimal host,String proof,String reason,String actor) {
        organizationId=row.getOrganizationId();commissionId=row.getId();requestId=request;basisGross=basis;basisHost=hostBasis;
        beforeGross=row.getGrossCommission();beforeHost=row.getHostShare();afterGross=gross;afterHost=host;currency=row.getCurrency();this.proof=proof;this.reason=reason;this.actor=actor;
    }
    public Long getId(){return id;} public Long getCommissionId(){return commissionId;} public UUID getRequestId(){return requestId;}
    public BigDecimal getBasisGross(){return basisGross;} public BigDecimal getBasisHost(){return basisHost;}
    public BigDecimal getBeforeGross(){return beforeGross;} public BigDecimal getAfterGross(){return afterGross;}
    public BigDecimal getBeforeHost(){return beforeHost;} public BigDecimal getAfterHost(){return afterHost;}
    public String getCurrency(){return currency;} public String getProof(){return proof;} public String getReason(){return reason;} public String getActor(){return actor;} public Instant getCreatedAt(){return createdAt;}
}
