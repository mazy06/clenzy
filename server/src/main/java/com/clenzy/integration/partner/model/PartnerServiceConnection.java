package com.clenzy.integration.partner.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Connexion API key vers un service partenaire du catalogue Integrations
 * (marketing/CRM, menage, avis, fiscalite, assurance). Multi-tenant via filtre
 * Hibernate. Une connexion par couple (organization_id, provider_type).
 *
 * <p>Mirror de {@code KycConnection} : entity unique discriminee par
 * {@link PartnerServiceType} plutot qu'une entity par provider — meme structure
 * pour tous (serveur, identifiant de compte, cle chiffree, statut).</p>
 */
@Entity
@Table(name = "partner_service_connections",
    indexes = @Index(name = "idx_partner_conn_org", columnList = "organization_id"))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PartnerServiceConnection {

    public enum Status { ACTIVE, ERROR, REVOKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 30)
    private PartnerServiceType providerType;

    @Column(name = "server_url", nullable = false, length = 500)
    private String serverUrl;

    @Column(name = "account_identifier", length = 200)
    private String accountIdentifier;

    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    // ---- Getters / setters ----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public PartnerServiceType getProviderType() { return providerType; }
    public void setProviderType(PartnerServiceType providerType) { this.providerType = providerType; }

    public String getServerUrl() { return serverUrl; }
    public void setServerUrl(String serverUrl) { this.serverUrl = serverUrl; }

    public String getAccountIdentifier() { return accountIdentifier; }
    public void setAccountIdentifier(String accountIdentifier) { this.accountIdentifier = accountIdentifier; }

    public String getApiKeyEncrypted() { return apiKeyEncrypted; }
    public void setApiKeyEncrypted(String apiKeyEncrypted) { this.apiKeyEncrypted = apiKeyEncrypted; }

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
}
