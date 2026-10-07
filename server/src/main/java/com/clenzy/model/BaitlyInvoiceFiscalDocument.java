package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Document préparé en interne ; l'archivage ne prouve ni transmission ni paiement. */
@Entity @Table(name="baitly_invoice_fiscal_documents",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","invoice_id"}))
public class BaitlyInvoiceFiscalDocument {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="invoice_id",nullable=false) private Long invoiceId;
    @Column(name="source_hash",nullable=false,length=64) private String sourceHash;
    @Column(name="document_hash",nullable=false,length=64) private String documentHash;
    @Column(nullable=false,columnDefinition="text") private String preparation;
    @Column(nullable=false,columnDefinition="text") private String xml;
    @Column(nullable=false,length=120) private String validation;
    @Column(name="created_by",nullable=false,length=255) private String createdBy;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected BaitlyInvoiceFiscalDocument() {}
    public BaitlyInvoiceFiscalDocument(Long org,Long invoice,String sourceHash,String documentHash,String preparation,String xml,String validation,String actor) {
        this.organizationId=org;this.invoiceId=invoice;this.sourceHash=sourceHash;this.documentHash=documentHash;
        this.preparation=preparation;this.xml=xml;this.validation=validation;this.createdBy=actor;this.createdAt=Instant.now();
    }
    public Long getId(){return id;}
    public String getSourceHash(){return sourceHash;}
    public String getDocumentHash(){return documentHash;}
    public String getPreparation(){return preparation;}
    public String getXml(){return xml;}
    public String getValidation(){return validation;}
    public Instant getCreatedAt(){return createdAt;}
}
