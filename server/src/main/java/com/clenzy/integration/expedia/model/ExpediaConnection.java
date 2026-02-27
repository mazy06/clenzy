package com.clenzy.integration.expedia.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * JPA entity representant une connexion entre une organisation Clenzy
 * et un compte Expedia/VRBO Partner Central.
 *
 * Stocke les credentials API chiffres et les metadonnees de connexion.
 */
@Entity
@Table(name = "expedia_connections", indexes = {
    @Index(name = "idx_expedia_conn_org_id", columnList = "organization_id"),
    @Index(name = "idx_expedia_conn_property_id", columnList = "property_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ExpediaConnection {

    public enum ExpediaConnectionStatus {
        ACTIVE,
        INACTIVE,
        ERROR
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false, length = 100)
    private String propertyId;

    @Column(name = "api_key_encrypted", columnDefinition = "TEXT", nullable = false)
    private String apiKeyEncrypted;

    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT", nullable = false)
    private String apiSecretEncrypted;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExpediaConnectionStatus status = ExpediaConnectionStatus.ACTIVE;

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
    public ExpediaConnection() {
    }

    public ExpediaConnection(Long organizationId, String propertyId,
                             String apiKeyEncrypted, String apiSecretEncrypted) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.apiKeyEncrypted = apiKeyEncrypted;
        this.apiSecretEncrypted = apiSecretEncrypted;
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
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public String getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(String propertyId) {
        this.propertyId = propertyId;
    }

    public String getApiKeyEncrypted() {
        return apiKeyEncrypted;
    }

    public void setApiKeyEncrypted(String apiKeyEncrypted) {
        this.apiKeyEncrypted = apiKeyEncrypted;
    }

    public String getApiSecretEncrypted() {
        return apiSecretEncrypted;
    }

    public void setApiSecretEncrypted(String apiSecretEncrypted) {
        this.apiSecretEncrypted = apiSecretEncrypted;
    }

    public ExpediaConnectionStatus getStatus() {
        return status;
    }

    public void setStatus(ExpediaConnectionStatus status) {
        this.status = status;
    }

    public LocalDateTime getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(LocalDateTime connectedAt) {
        this.connectedAt = connectedAt;
    }

    public LocalDateTime getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(LocalDateTime lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Methodes utilitaires
    public boolean isActive() {
        return ExpediaConnectionStatus.ACTIVE.equals(this.status);
    }

    @Override
    public String toString() {
        return "ExpediaConnection{" +
                "id=" + id +
                ", organizationId=" + organizationId +
                ", propertyId='" + propertyId + '\'' +
                ", status=" + status +
                ", connectedAt=" + connectedAt +
                '}';
    }
}
