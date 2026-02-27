package com.clenzy.integration.homeaway.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * JPA entity representant une connexion OAuth2 entre une organisation Clenzy et HomeAway/Abritel.
 * Stocke les tokens chiffres et les metadonnees de connexion.
 */
@Entity
@Table(name = "homeaway_connections", indexes = {
    @Index(name = "idx_homeaway_conn_org_id", columnList = "organization_id"),
    @Index(name = "idx_homeaway_conn_listing_id", columnList = "listing_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class HomeAwayConnection {

    public enum HomeAwayConnectionStatus {
        ACTIVE,
        INACTIVE,
        EXPIRED,
        ERROR
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "listing_id")
    private String listingId;

    @Column(name = "access_token_encrypted", columnDefinition = "TEXT", nullable = false)
    private String accessTokenEncrypted;

    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private HomeAwayConnectionStatus status = HomeAwayConnectionStatus.ACTIVE;

    @Column(name = "connected_at", nullable = false, updatable = false)
    private LocalDateTime connectedAt;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public HomeAwayConnection() {}

    public HomeAwayConnection(Long organizationId, String accessTokenEncrypted) {
        this.organizationId = organizationId;
        this.accessTokenEncrypted = accessTokenEncrypted;
    }

    // Lifecycle callbacks
    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.connectedAt == null) {
            this.connectedAt = now;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getListingId() { return listingId; }
    public void setListingId(String listingId) { this.listingId = listingId; }

    public String getAccessTokenEncrypted() { return accessTokenEncrypted; }
    public void setAccessTokenEncrypted(String accessTokenEncrypted) { this.accessTokenEncrypted = accessTokenEncrypted; }

    public String getRefreshTokenEncrypted() { return refreshTokenEncrypted; }
    public void setRefreshTokenEncrypted(String refreshTokenEncrypted) { this.refreshTokenEncrypted = refreshTokenEncrypted; }

    public LocalDateTime getTokenExpiresAt() { return tokenExpiresAt; }
    public void setTokenExpiresAt(LocalDateTime tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }

    public HomeAwayConnectionStatus getStatus() { return status; }
    public void setStatus(HomeAwayConnectionStatus status) { this.status = status; }

    public LocalDateTime getConnectedAt() { return connectedAt; }
    public void setConnectedAt(LocalDateTime connectedAt) { this.connectedAt = connectedAt; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    // Methodes utilitaires
    public boolean isActive() {
        return HomeAwayConnectionStatus.ACTIVE.equals(this.status);
    }

    public boolean isTokenExpired() {
        return this.tokenExpiresAt != null && LocalDateTime.now().isAfter(this.tokenExpiresAt);
    }

    @Override
    public String toString() {
        return "HomeAwayConnection{id=" + id
                + ", organizationId=" + organizationId
                + ", listingId='" + listingId + "'"
                + ", status=" + status
                + ", connectedAt=" + connectedAt + "}";
    }
}
