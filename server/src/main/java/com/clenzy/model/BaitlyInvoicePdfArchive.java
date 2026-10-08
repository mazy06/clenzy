package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="baitly_invoice_pdf_archives",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","invoice_id"}))
public class BaitlyInvoicePdfArchive {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="invoice_id",nullable=false) private Long invoiceId;
    @Column(name="source_hash",nullable=false,length=64) private String sourceHash;
    @Column(name="document_hash",nullable=false,length=64) private String documentHash;
    @Column(nullable=false,columnDefinition="bytea") private byte[] content;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected BaitlyInvoicePdfArchive() {}
    public BaitlyInvoicePdfArchive(Long org,Long invoice,String source,String hash,byte[] content){this.organizationId=org;this.invoiceId=invoice;this.sourceHash=source;this.documentHash=hash;this.content=content.clone();this.createdAt=Instant.now();}
    public String getSourceHash(){return sourceHash;}
    public String getDocumentHash(){return documentHash;}
    public byte[] getContent(){return content.clone();}
    public Instant getCreatedAt(){return createdAt;}
}
