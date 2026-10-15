package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Relation privée, distincte de la publication d'une fiche dans l'annuaire. */
@Entity
@Table(name="baitly_network_links", uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","provider_id"}))
public class BaitlyNetworkLink {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="provider_id",nullable=false) private Long providerId;
    @Column(nullable=false,length=20) private String status;
    @Column(name="token_hash",length=64) private String tokenHash;
    @Column(name="expires_at") private Instant expiresAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @Version private long version;
    public Long getId(){return id;}
    public Long getOrganizationId(){return organizationId;}
    public void setOrganizationId(Long value){organizationId=value;}
    public Long getProviderId(){return providerId;}
    public void setProviderId(Long value){providerId=value;}
    public String getStatus(){return status;}
    public void setStatus(String value){status=value;}
    public String getTokenHash(){return tokenHash;}
    public void setTokenHash(String value){tokenHash=value;}
    public Instant getExpiresAt(){return expiresAt;}
    public void setExpiresAt(Instant value){expiresAt=value;}
    public Instant getUpdatedAt(){return updatedAt;}
    public void setUpdatedAt(Instant value){updatedAt=value;}
}
