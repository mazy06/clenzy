package com.clenzy.model;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

/** Pièce émise par le vendeur/partenaire ; elle ne déclenche ni paiement ni nouvelle facture. */
@Entity @Table(name="baitly_commerce_evidence",uniqueConstraints={@UniqueConstraint(columnNames={"organization_id","request_id"}),@UniqueConstraint(columnNames={"organization_id","source","source_id","kind","financial_reference"})})
public class BaitlyCommerceEvidence {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(nullable=false,length=24) private String source;
    @Column(name="source_id",nullable=false) private Long sourceId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(nullable=false,length=24) private String kind;
    @Column(name="financial_reference",nullable=false,length=255) private String financialReference;
    @Column(name="document_number",nullable=false,length=100) private String documentNumber;
    @Column(nullable=false,length=200) private String issuer;
    @Column(name="issuer_reference",nullable=false,length=255) private String issuerReference;
    @Column(nullable=false,precision=12,scale=2) private BigDecimal amount;
    @Column(nullable=false,length=3) private String currency;
    @Column(nullable=false,length=64) private String sha256;
    @Column(nullable=false,length=40) private String mime;
    @JdbcTypeCode(SqlTypes.VARBINARY) @Column(nullable=false,columnDefinition="bytea") private byte[] content;
    @Column(nullable=false,length=255) private String actor;
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyCommerceEvidence(){}
    public BaitlyCommerceEvidence(Long org,String source,Long sourceId,UUID request,String kind,String ref,String number,String issuer,String issuerReference,BigDecimal amount,String currency,String sha256,String mime,byte[] content,String actor){
        organizationId=org;this.source=source;this.sourceId=sourceId;requestId=request;this.kind=kind;financialReference=ref;documentNumber=number;this.issuer=issuer;this.issuerReference=issuerReference;this.amount=amount;this.currency=currency;this.sha256=sha256;this.mime=mime;this.content=content.clone();this.actor=actor;
    }
    public Long getId(){return id;}public Long getOrganizationId(){return organizationId;}public String getSource(){return source;}public Long getSourceId(){return sourceId;}
    public UUID getRequestId(){return requestId;}public String getKind(){return kind;}public String getFinancialReference(){return financialReference;}public String getDocumentNumber(){return documentNumber;}
    public String getIssuer(){return issuer;}public String getIssuerReference(){return issuerReference;}public BigDecimal getAmount(){return amount;}public String getCurrency(){return currency;}
    public String getSha256(){return sha256;}public String getMime(){return mime;}public byte[] getContent(){return content.clone();}public Instant getCreatedAt(){return createdAt;}
}
