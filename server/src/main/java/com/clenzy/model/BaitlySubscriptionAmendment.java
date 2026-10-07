package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;

/** Proposition immuable de changement au renouvellement, distincte du contrat déjà payé. */
@Entity @Table(name="baitly_subscription_amendments",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","request_id"}))
public class BaitlySubscriptionAmendment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="order_id",nullable=false) private Long orderId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private Terms terms;
    @Column(nullable=false) private String status="PREPARED";
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    @Column(name="applied_invoice_id") private String appliedInvoiceId;
    public record Terms(String plan,int properties,String currency,int subscriptionMonth,long effectiveAt,
                        long monthOne,long monthFour,long monthSeven,long monthThirteen,String version) {
        public long monthly(){return subscriptionMonth<=3?monthOne:subscriptionMonth<=6?monthFour:subscriptionMonth<=12?monthSeven:monthThirteen;}
    }
    protected BaitlySubscriptionAmendment() {}
    public BaitlySubscriptionAmendment(Long org,Long order,UUID request,Terms value){organizationId=org;orderId=order;requestId=request;terms=value;}
    public Long getId(){return id;} public Long getOrganizationId(){return organizationId;} public Long getOrderId(){return orderId;}
    public UUID getRequestId(){return requestId;} public Terms getTerms(){return terms;} public String getStatus(){return status;}
    public void setStatus(String value){status=value;} public Instant getCreatedAt(){return createdAt;}
    public String getAppliedInvoiceId(){return appliedInvoiceId;} public void setAppliedInvoiceId(String value){appliedInvoiceId=value;}
}
