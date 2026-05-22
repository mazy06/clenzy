package com.clenzy.integration.xero.model;

import com.clenzy.integration.oauth.OAuthConnectionLike;
import com.clenzy.integration.oauth.OAuthConnectionStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Connexion OAuth2 Xero par organisation.
 *
 * <h2>Champs specifiques : tenant_id / tenant_name</h2>
 * Xero supporte le multi-tenant — un utilisateur peut autoriser plusieurs
 * organisations Xero. Apres exchange du code, on appelle {@code GET /connections}
 * pour recuperer la liste et stocker celle selectionnee (premiere par defaut).
 */
@Entity
@Table(name = "xero_connections",
    indexes = @Index(name = "idx_xero_connections_org", columnList = "organization_id"))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class XeroConnection implements OAuthConnectionLike {

    public enum Status { ACTIVE, EXPIRED, ERROR, REVOKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "access_token_encrypted", columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "token_expires_at")
    private Instant tokenExpiresAt;

    @Column(name = "refresh_token_expires_at")
    private Instant refreshTokenExpiresAt;

    @Column(name = "scopes", length = 500)
    private String scopes;

    @Column(name = "tenant_id", length = 100)
    private String tenantId;

    @Column(name = "tenant_name", length = 200)
    private String tenantName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "connected_at")
    private Instant connectedAt;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @Override public Long getOrganizationId() { return organizationId; }
    @Override public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    @Override public Long getUserId() { return userId; }
    @Override public void setUserId(Long userId) { this.userId = userId; }

    @Override public String getAccessTokenEncrypted() { return accessTokenEncrypted; }
    @Override public void setAccessTokenEncrypted(String v) { this.accessTokenEncrypted = v; }

    @Override public String getRefreshTokenEncrypted() { return refreshTokenEncrypted; }
    @Override public void setRefreshTokenEncrypted(String v) { this.refreshTokenEncrypted = v; }

    @Override public Instant getTokenExpiresAt() { return tokenExpiresAt; }
    @Override public void setTokenExpiresAt(Instant v) { this.tokenExpiresAt = v; }

    @Override public Instant getRefreshTokenExpiresAt() { return refreshTokenExpiresAt; }
    @Override public void setRefreshTokenExpiresAt(Instant v) { this.refreshTokenExpiresAt = v; }

    @Override public String getScopes() { return scopes; }
    @Override public void setScopes(String v) { this.scopes = v; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    @Override public String getErrorMessage() { return errorMessage; }
    @Override public void setErrorMessage(String v) { this.errorMessage = v; }

    @Override public Instant getConnectedAt() { return connectedAt; }
    @Override public void setConnectedAt(Instant v) { this.connectedAt = v; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    @Override
    public OAuthConnectionStatus getOAuthStatus() {
        return status == null ? null : OAuthConnectionStatus.valueOf(status.name());
    }

    @Override
    public void setOAuthStatus(OAuthConnectionStatus oauthStatus) {
        this.status = oauthStatus == null ? null : Status.valueOf(oauthStatus.name());
    }
}
