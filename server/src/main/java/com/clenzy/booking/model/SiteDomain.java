package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Domaine d'un site hébergé (P1.1) : sous-domaine `{slug}.clenzy.site` ou domaine custom
 * (`reservation.monhotel.com`). Le TLS + la vérification sont gérés via Cloudflare for SaaS
 * (custom hostnames) ; {@code cloudflareHostnameId} trace l'identifiant côté Cloudflare.
 */
@Entity
@Table(name = "site_domains",
    indexes = {
        @Index(name = "idx_site_domains_site_id", columnList = "site_id"),
        @Index(name = "idx_site_domains_org_id", columnList = "organization_id"),
        @Index(name = "idx_site_domains_hostname", columnList = "hostname", unique = true)
    })
public class SiteDomain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id", nullable = false)
    private Long siteId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "hostname", nullable = false, unique = true, length = 253)
    private String hostname;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SiteDomainStatus status = SiteDomainStatus.PENDING;

    @Column(name = "verified", nullable = false)
    private boolean verified = false;

    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    /** Identifiant du custom hostname côté Cloudflare for SaaS (suivi TLS/vérification). */
    @Column(name = "cloudflare_hostname_id", length = 128)
    private String cloudflareHostnameId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public SiteDomainStatus getStatus() { return status; }
    public void setStatus(SiteDomainStatus status) { this.status = status; }

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }

    public boolean isPrimary() { return primary; }
    public void setPrimary(boolean primary) { this.primary = primary; }

    public String getCloudflareHostnameId() { return cloudflareHostnameId; }
    public void setCloudflareHostnameId(String cloudflareHostnameId) { this.cloudflareHostnameId = cloudflareHostnameId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
