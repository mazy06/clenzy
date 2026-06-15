package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;

import java.time.Instant;

/**
 * Connexion a un service marketing au niveau plateforme (Brevo aujourd'hui,
 * extensible Mailchimp/etc. via {@link Provider}).
 *
 * <h2>Pourquoi une entity plateforme (et non org-scopee)</h2>
 * Contrairement a {@code ExternalServiceConnection} (signature, multi-tenant),
 * le marketing (waitlist, newsletter) utilise le compte Brevo <b>de Baitly</b>,
 * partage par toute la plateforme. Une seule connexion active par provider
 * (contrainte unique sur provider), pas d'organization_id, pas de tenant filter.
 *
 * <h2>Securite</h2>
 * {@code apiKey} est chiffree AES-256 au repos via {@link EncryptedFieldConverter}
 * (meme mecanisme que Airbnb / Channex / WhatsApp). Jamais stockee en clair,
 * jamais renvoyee en clair dans les DTO (masquee cote controller).
 *
 * <h2>Migration depuis .env</h2>
 * Remplace les variables BREVO_API_KEY / BREVO_WAITLIST_LIST_ID. Le service de
 * resolution lit d'abord la BDD, puis retombe sur l'env tant que la BDD est vide.
 */
@Entity
@Table(name = "marketing_integration")
public class MarketingIntegration {

    public enum Provider { BREVO }

    public enum Status { UNCONFIGURED, ACTIVE, ERROR }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 30, unique = true)
    private Provider provider = Provider.BREVO;

    /** Cle API marketing — chiffree AES-256 au repos. Jamais exposee en clair. */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "api_key_encrypted", columnDefinition = "TEXT")
    private String apiKey;

    @Column(name = "waitlist_list_id")
    private Long waitlistListId;

    @Column(name = "newsletter_list_id")
    private Long newsletterListId;

    @Column(name = "prospects_list_id")
    private Long prospectsListId;

    /** Liste Brevo des leads captés (exit-intent / panier abandonné) — 2.12. */
    @Column(name = "leads_list_id")
    private Long leadsListId;

    @Column(name = "sync_waitlist_enabled", nullable = false)
    private boolean syncWaitlistEnabled = true;

    @Column(name = "sync_newsletter_enabled", nullable = false)
    private boolean syncNewsletterEnabled = true;

    @Column(name = "sync_prospects_enabled", nullable = false)
    private boolean syncProspectsEnabled = true;

    @Column(name = "sync_leads_enabled", nullable = false)
    private boolean syncLeadsEnabled = true;

    @Column(name = "sync_attributes_enabled", nullable = false)
    private boolean syncAttributesEnabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.UNCONFIGURED;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    private String updatedBy;

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /** True si une cle API est renseignee (donc l'integration peut etre testee/utilisee). */
    @Transient
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    // --- Getters / setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public Long getWaitlistListId() { return waitlistListId; }
    public void setWaitlistListId(Long waitlistListId) { this.waitlistListId = waitlistListId; }

    public Long getNewsletterListId() { return newsletterListId; }
    public void setNewsletterListId(Long newsletterListId) { this.newsletterListId = newsletterListId; }

    public Long getProspectsListId() { return prospectsListId; }
    public void setProspectsListId(Long prospectsListId) { this.prospectsListId = prospectsListId; }

    public Long getLeadsListId() { return leadsListId; }
    public void setLeadsListId(Long leadsListId) { this.leadsListId = leadsListId; }

    public boolean isSyncWaitlistEnabled() { return syncWaitlistEnabled; }
    public void setSyncWaitlistEnabled(boolean syncWaitlistEnabled) { this.syncWaitlistEnabled = syncWaitlistEnabled; }

    public boolean isSyncNewsletterEnabled() { return syncNewsletterEnabled; }
    public void setSyncNewsletterEnabled(boolean syncNewsletterEnabled) { this.syncNewsletterEnabled = syncNewsletterEnabled; }

    public boolean isSyncProspectsEnabled() { return syncProspectsEnabled; }
    public void setSyncProspectsEnabled(boolean syncProspectsEnabled) { this.syncProspectsEnabled = syncProspectsEnabled; }

    public boolean isSyncLeadsEnabled() { return syncLeadsEnabled; }
    public void setSyncLeadsEnabled(boolean syncLeadsEnabled) { this.syncLeadsEnabled = syncLeadsEnabled; }

    public boolean isSyncAttributesEnabled() { return syncAttributesEnabled; }
    public void setSyncAttributesEnabled(boolean syncAttributesEnabled) { this.syncAttributesEnabled = syncAttributesEnabled; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Instant getLastTestedAt() { return lastTestedAt; }
    public void setLastTestedAt(Instant lastTestedAt) { this.lastTestedAt = lastTestedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
