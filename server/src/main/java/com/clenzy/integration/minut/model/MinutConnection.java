package com.clenzy.integration.minut.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "minut_connections", indexes = {
    @Index(name = "idx_minut_conn_user_id", columnList = "user_id", unique = true),
    @Index(name = "idx_minut_conn_status", columnList = "status")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class MinutConnection {

    public enum MinutConnectionStatus {
        ACTIVE, REVOKED, EXPIRED, ERROR
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "minut_user_id")
    private String minutUserId;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "minut_organization_id")
    private String minutOrganizationId;

    @Column(name = "access_token_encrypted", columnDefinition = "TEXT", nullable = false)
    private String accessTokenEncrypted;

    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "scopes", length = 500)
    private String scopes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MinutConnectionStatus status = MinutConnectionStatus.ACTIVE;

    @Column(name = "connected_at", nullable = false, updatable = false)
    private LocalDateTime connectedAt;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.connectedAt == null) this.connectedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return MinutConnectionStatus.ACTIVE.equals(this.status);
    }

    public boolean isTokenExpired() {
        return this.tokenExpiresAt != null && LocalDateTime.now().isAfter(this.tokenExpiresAt);
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getMinutUserId() { return minutUserId; }
    public void setMinutUserId(String minutUserId) { this.minutUserId = minutUserId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getMinutOrganizationId() { return minutOrganizationId; }
    public void setMinutOrganizationId(String minutOrganizationId) { this.minutOrganizationId = minutOrganizationId; }

    public String getAccessTokenEncrypted() { return accessTokenEncrypted; }
    public void setAccessTokenEncrypted(String accessTokenEncrypted) { this.accessTokenEncrypted = accessTokenEncrypted; }

    public String getRefreshTokenEncrypted() { return refreshTokenEncrypted; }
    public void setRefreshTokenEncrypted(String refreshTokenEncrypted) { this.refreshTokenEncrypted = refreshTokenEncrypted; }

    public LocalDateTime getTokenExpiresAt() { return tokenExpiresAt; }
    public void setTokenExpiresAt(LocalDateTime tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }

    public String getScopes() { return scopes; }
    public void setScopes(String scopes) { this.scopes = scopes; }

    public MinutConnectionStatus getStatus() { return status; }
    public void setStatus(MinutConnectionStatus status) { this.status = status; }

    public LocalDateTime getConnectedAt() { return connectedAt; }
    public void setConnectedAt(LocalDateTime connectedAt) { this.connectedAt = connectedAt; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
