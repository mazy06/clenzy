package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;

/** Copie immuable du document émis par le PSP, avec tentative durable avant émission d'un avoir. */
@Entity @Table(name="baitly_sale_documents")
public class BaitlySaleDocument {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false,updatable=false) private Long organizationId;
    @Column(nullable=false,updatable=false) private String source;
    @Column(name="source_id",updatable=false) private Long sourceId;
    @Column(name="source_ref",nullable=false,updatable=false) private String sourceRef;
    @Column(name="refund_ref",nullable=false,updatable=false) private String refundRef="";
    @Column(nullable=false) private String state="PENDING";
    @Column(name="first_attempt_at") private Instant firstAttemptAt;
    @Column(name="retry_at",nullable=false) private Instant retryAt=Instant.now();
    @Column(name="checked_at") private Instant checkedAt;
    @Column(name="lease_token") private UUID leaseToken;
    @Column(name="provider_account") private String providerAccount;
    @Column(name="provider_ref") private String providerRef;
    private String number;
    private String currency;
    @Column(name="net_cents") private Long netCents;
    @Column(name="total_cents") private Long totalCents;
    @Column(name="pdf_url",columnDefinition="text") private String pdfUrl;
    @Column(name="issued_at") private Instant issuedAt;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") private Map<String,Object> snapshot;
    private String failure;
    protected BaitlySaleDocument(){}
    public BaitlySaleDocument(Long org,String source,Long id,String ref,String refund){organizationId=org;this.source=source;sourceId=id;sourceRef=ref;refundRef=refund;}
    public Long getId(){return id;} public Long getOrganizationId(){return organizationId;}
    public String getSource(){return source;} public Long getSourceId(){return sourceId;} public String getSourceRef(){return sourceRef;} public String getRefundRef(){return refundRef;}
    public String getState(){return state;} public UUID getLeaseToken(){return leaseToken;} public Instant getFirstAttemptAt(){return firstAttemptAt;}
    public String getProviderRef(){return providerRef;} public String getProviderAccount(){return providerAccount;}
    public String getNumber(){return number;} public String getCurrency(){return currency;} public Long getNetCents(){return netCents;} public Long getTotalCents(){return totalCents;}
    public String getPdfUrl(){return pdfUrl;} public Instant getIssuedAt(){return issuedAt;} public Map<String,Object> getSnapshot(){return snapshot;} public String getFailure(){return failure;}
    public Instant getRetryAt(){return retryAt;}
    public void claim(){state="PROCESSING";leaseToken=UUID.randomUUID();retryAt=Instant.now().plusSeconds(600);}
    public void emitting(){if(firstAttemptAt==null)firstAttemptAt=Instant.now();}
    public void retry(String code){state=providerRef==null?"REVIEW_REQUIRED":"READY";failure=code;checkedAt=Instant.now();retryAt=checkedAt.plusSeconds(3600);leaseToken=null;}
    public void complete(String account,String ref,String num,String cur,long net,long gross,String url,Instant issued,Map<String,Object> data){
        if(providerRef!=null && (!Objects.equals(account,providerAccount)||!Objects.equals(ref,providerRef)||!Objects.equals(num,number)||!Objects.equals(cur,currency)||netCents!=net||totalCents!=gross||!Objects.equals(issued,issuedAt)||!Objects.equals(snapshot,data)))throw new IllegalStateException("DOCUMENT_IMMUTABLE_MISMATCH");
        providerAccount=account;providerRef=ref;number=num;currency=cur;netCents=net;totalCents=gross;pdfUrl=url;issuedAt=issued;snapshot=data;
        state="READY";failure=null;checkedAt=Instant.now();retryAt=checkedAt.plusSeconds(source.equals("SUBSCRIPTION") && refundRef.isEmpty()?3600:86400);leaseToken=null;
    }
}
