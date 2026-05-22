package com.clenzy.integration.external.model;

import com.clenzy.service.signature.SignatureProviderType;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Connexion API generique vers un service externe (signature electronique
 * principalement, extensible aux autres services).
 *
 * <h2>Pourquoi une entity unique</h2>
 * Au lieu de creer une entity par provider (YousignConnection, UniversignConnection,
 * DocaPosteConnection, ...) qui auraient toutes la meme structure
 * (organizationId, serverUrl, apiKey, status, dates), on consolide dans une
 * seule table avec un discriminant {@code provider_type}. Reduit la surface
 * de code de 80% et permet d'ajouter un nouveau provider QTSP en quelques
 * lignes (juste etendre l'enum).
 *
 * <h2>Multi-tenant</h2>
 * Contrainte unique (organization_id, provider_type) : une seule connexion
 * active par couple org x provider. Pas besoin de gerer plusieurs comptes
 * Yousign pour la meme organisation — si l'org veut changer de compte, elle
 * disconnect puis reconnect.
 *
 * <h2>Securite</h2>
 * api_key_encrypted : chiffre AES-256 via Jasypt (meme cle que les autres
 * services : Airbnb, Pennylane, Odoo). Jamais expose en clair, meme dans
 * les DTO de reponse.
 *
 * <h2>Note importante : ne couvre PAS DocuSign / Pennylane</h2>
 * Ces deux providers utilisent OAuth2 (access_token + refresh_token) et ont
 * leurs propres entities dediees (PennylaneConnection existe deja, DocuSign
 * a son propre OAuth flow a venir).
 */
@Entity
@Table(name = "external_service_connections",
    indexes = {
        @Index(name = "idx_external_conn_org", columnList = "organization_id"),
        @Index(name = "uq_external_conn_org_provider",
                columnList = "organization_id, provider_type", unique = true)
    })
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ExternalServiceConnection {

    public enum Status {
        ACTIVE, ERROR, REVOKED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 30)
    private SignatureProviderType providerType;

    @Column(name = "server_url", nullable = false, length = 500)
    private String serverUrl;

    /** Champ libre (ex : nom de base pour Odoo-like, account id pour Yousign). */
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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    // ---- Getters / setters ----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public SignatureProviderType getProviderType() { return providerType; }
    public void setProviderType(SignatureProviderType providerType) { this.providerType = providerType; }

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
