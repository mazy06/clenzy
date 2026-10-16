package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Immutable receipt for a mission's stock counts, additions and linked expenses. */
@Entity @Table(name="baitly_restock_ledger")
public class BaitlyRestockLedger {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="request_key",nullable=false,unique=true,length=36) private String requestKey;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="intervention_id",nullable=false) private Long interventionId;
    @Column(name="property_id",nullable=false) private Long propertyId;
    @Column(name="actor_key",nullable=false,length=255) private String actorKey;
    @Column(name="request_body",nullable=false,columnDefinition="text") private String requestBody;
    @Column(name="receipt",nullable=false,columnDefinition="text") private String receipt;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    public BaitlyRestockLedger() {}
    public BaitlyRestockLedger(String key,Long org,Long mission,Long property,String actor,String body,String receipt,Instant now) {
        this.requestKey=key;this.organizationId=org;this.interventionId=mission;this.propertyId=property;this.actorKey=actor;this.requestBody=body;this.receipt=receipt;this.createdAt=now;
    }
    public Long getInterventionId(){return interventionId;}
    public String getActorKey(){return actorKey;}
    public String getRequestBody(){return requestBody;}
    public String getReceipt(){return receipt;}
}
