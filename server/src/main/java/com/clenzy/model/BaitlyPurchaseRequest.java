package com.clenzy.model;
import jakarta.persistence.*;
import java.util.UUID;

/** Intention persistée avant réseau ; aucun secret ni token invité n'est stocké. */
@Entity @Table(name="baitly_purchase_requests",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","request_id"}))
public class BaitlyPurchaseRequest {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(nullable=false,length=30) private String source;
    @Column(name="source_id",nullable=false) private Long sourceId;
    @Column(nullable=false,length=64) private String fingerprint;
    protected BaitlyPurchaseRequest(){}
    public BaitlyPurchaseRequest(Long org,UUID request,String source,Long sourceId,String fingerprint){organizationId=org;requestId=request;this.source=source;this.sourceId=sourceId;this.fingerprint=fingerprint;}
    public Long getSourceId(){return sourceId;}public String getSource(){return source;}public String getFingerprint(){return fingerprint;}
}
