package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * Contact marketing capturé via le Booking Engine (CLZ Domaine 2 — capture de leads / email marketing) :
 * newsletter, waitlist, exit-intent, panier abandonné. Org-scopé, dédupliqué par (org, email).
 * Le <b>consentement RGPD</b> est obligatoire à la capture (booléen + horodatage).
 */
@Entity
@Table(name = "marketing_contacts",
        uniqueConstraints = @UniqueConstraint(name = "uq_marketing_contacts_org_email",
                columnNames = {"organization_id", "email"}))
public class MarketingContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(name = "name", length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 30)
    private MarketingContactSource source = MarketingContactSource.OTHER;

    @Column(name = "locale", length = 10)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MarketingContactStatus status = MarketingContactStatus.SUBSCRIBED;

    @Column(name = "consent", nullable = false)
    private boolean consent;

    @Column(name = "consent_at")
    private Instant consentAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public MarketingContactSource getSource() { return source; }
    public void setSource(MarketingContactSource source) { this.source = source; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public MarketingContactStatus getStatus() { return status; }
    public void setStatus(MarketingContactStatus status) { this.status = status; }
    public boolean isConsent() { return consent; }
    public void setConsent(boolean consent) { this.consent = consent; }
    public Instant getConsentAt() { return consentAt; }
    public void setConsentAt(Instant consentAt) { this.consentAt = consentAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
