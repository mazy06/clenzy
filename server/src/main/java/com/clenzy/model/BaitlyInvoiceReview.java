package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Résultat append-only d'une vérification, jamais une preuve de transmission ou de paiement. */
@Entity @Table(name="baitly_invoice_reviews")
public class BaitlyInvoiceReview {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="invoice_id",nullable=false) private Long invoiceId;
    @Column(name="source_hash",nullable=false,length=64) private String sourceHash;
    @Column(nullable=false,length=64) private String version;
    @Column(nullable=false,length=32) private String state;
    @Column(nullable=false,columnDefinition="text") private String issues;
    @Column(nullable=false,length=255) private String actor;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected BaitlyInvoiceReview() {}
    public BaitlyInvoiceReview(Long org,Long invoice,String hash,String version,String state,String issues,String actor){this.organizationId=org;this.invoiceId=invoice;this.sourceHash=hash;this.version=version;this.state=state;this.issues=issues;this.actor=actor;this.createdAt=Instant.now();}
    public Long getId(){return id;}
    public Long getInvoiceId(){return invoiceId;}
    public String getSourceHash(){return sourceHash;}
    public String getVersion(){return version;}
    public String getState(){return state;}
    public String getIssues(){return issues;}
    public String getActor(){return actor;}
    public Instant getCreatedAt(){return createdAt;}
}
