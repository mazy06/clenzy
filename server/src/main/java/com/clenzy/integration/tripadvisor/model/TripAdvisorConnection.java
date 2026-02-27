package com.clenzy.integration.tripadvisor.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Connexion entre une organisation Clenzy et un compte TripAdvisor Vacation Rentals.
 * Les credentials API (key + secret) sont stockees chiffrees.
 */
@Entity
@Table(name = "tripadvisor_connections", indexes = {
    @Index(name = "idx_tripadvisor_conn_org_id", columnList = "organization_id", unique = true),
    @Index(name = "idx_tripadvisor_conn_partner_id", columnList = "partner_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class TripAdvisorConnection {

    public enum TripAdvisorConnectionStatus {
        ACTIVE,
        INACTIVE,
        ERROR
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "partner_id", nullable = false, length = 100)
    private String partnerId;

    @Column(name = "api_key_encrypted", columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TripAdvisorConnectionStatus status = TripAdvisorConnectionStatus.ACTIVE;

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
    public TripAdvisorConnection() {}

    public TripAdvisorConnection(Long organizationId, String partnerId) {
        this.organizationId = organizationId;
        this.partnerId = partnerId;
    }

    // Lifecycle callbacks
    @PrePersist
    public void prePersist() {
        final var now = LocalDateTime.now();
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

    public String getPartnerId() { return partnerId; }
    public void setPartnerId(String partnerId) { this.partnerId = partnerId; }

    public String getApiKeyEncrypted() { return apiKeyEncrypted; }
    public void setApiKeyEncrypted(String apiKeyEncrypted) { this.apiKeyEncrypted = apiKeyEncrypted; }

    public String getApiSecretEncrypted() { return apiSecretEncrypted; }
    public void setApiSecretEncrypted(String apiSecretEncrypted) { this.apiSecretEncrypted = apiSecretEncrypted; }

    public TripAdvisorConnectionStatus getStatus() { return status; }
    public void setStatus(TripAdvisorConnectionStatus status) { this.status = status; }

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
        return TripAdvisorConnectionStatus.ACTIVE.equals(this.status);
    }

    @Override
    public String toString() {
        return "TripAdvisorConnection{id=" + id
                + ", organizationId=" + organizationId
                + ", partnerId='" + partnerId + "'"
                + ", status=" + status
                + ", connectedAt=" + connectedAt + "}";
    }
}
