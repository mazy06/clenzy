package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Historique opérationnel immuable ; n'est jamais une preuve de paiement. */
@Entity @Table(name="baitly_commerce_operations",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","request_id"}))
public class BaitlyCommerceOperation {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(nullable=false,length=30) private String source;
    @Column(name="source_id",nullable=false) private Long sourceId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(nullable=false,length=30) private String action;
    @Column(nullable=false,length=255) private String proof;
    @Column(nullable=false,length=1000) private String note;
    @Column(nullable=false,length=255) private String actor;
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyCommerceOperation() {}
    public BaitlyCommerceOperation(Long org,String source,Long sourceId,UUID request,String action,String proof,String note,String actor) {
        organizationId=org;this.source=source;this.sourceId=sourceId;requestId=request;this.action=action;this.proof=proof;this.note=note;this.actor=actor;
    }
    public Long getId(){return id;}public String getSource(){return source;}public Long getSourceId(){return sourceId;}public UUID getRequestId(){return requestId;}
    public String getAction(){return action;}public String getProof(){return proof;}public String getNote(){return note;}public String getActor(){return actor;}public Instant getCreatedAt(){return createdAt;}
}
