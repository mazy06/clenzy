package com.clenzy.integration.odoo.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Connexion API Odoo par organisation.
 *
 * Contrairement a Pennylane (OAuth2), Odoo s'authentifie via API key + URL
 * serveur + nom de base + login utilisateur. C'est le pattern standard pour
 * Odoo SaaS (odoo.com) et self-hosted (Odoo SH ou on-prem).
 *
 * Stockage securise : l'API key est chiffree (AES-256-GCM via
 * TokenEncryptionService — meme service que les tokens OAuth Pennylane).
 *
 * Note: @FilterDef est defini une seule fois dans
 * com.clenzy.model.package-info.java (multi-tenancy).
 */
@Entity
@Table(name = "odoo_connections",
    indexes = @Index(name = "idx_odoo_connections_org", columnList = "organization_id"))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OdooConnection {

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

    /** URL de l'instance Odoo, ex: https://mycompany.odoo.com */
    @Column(name = "server_url", nullable = false, length = 500)
    private String serverUrl;

    /** Nom de la base Odoo (ex: 'mycompany'). Visible dans /web?db=... */
    @Column(name = "database_name", nullable = false, length = 200)
    private String databaseName;

    /** Login utilisateur Odoo (email ou identifiant). Utilise pour les calls XML-RPC. */
    @Column(name = "user_login", nullable = false, length = 200)
    private String userLogin;

    /** API key Odoo chiffree. Generee dans Odoo > Preferences utilisateur > Securite. */
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
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ---- Getters / Setters ----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getServerUrl() { return serverUrl; }
    public void setServerUrl(String serverUrl) { this.serverUrl = serverUrl; }

    public String getDatabaseName() { return databaseName; }
    public void setDatabaseName(String databaseName) { this.databaseName = databaseName; }

    public String getUserLogin() { return userLogin; }
    public void setUserLogin(String userLogin) { this.userLogin = userLogin; }

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
