package com.clenzy.integration.channel.model;

import com.clenzy.integration.channel.ChannelName;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Connexion generique entre une organisation et un channel.
 * Une organisation peut avoir au plus une connexion par channel.
 *
 * Pour Airbnb, credentials_ref pointe vers l'AirbnbConnection existante.
 * Pour iCal, credentials_ref n'est pas utilise (pas d'auth).
 * Pour Booking/VRBO, credentials_ref pointera vers un vault key.
 */
@Entity
@Table(
    name = "channel_connections",
    uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "channel"})
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ChannelConnection {

    public enum ConnectionStatus {
        ACTIVE, INACTIVE, ERROR
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ChannelName channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConnectionStatus status = ConnectionStatus.ACTIVE;

    @Column(name = "credentials_ref", length = 255)
    private String credentialsRef;

    @Column(name = "external_property_id", length = 255)
    private String externalPropertyId;

    @Column(name = "webhook_url")
    private String webhookUrl;

    @Column(name = "sync_config", columnDefinition = "JSONB")
    private String syncConfig;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs
    public ChannelConnection() {}

    public ChannelConnection(Long organizationId, ChannelName channel) {
        this.organizationId = organizationId;
        this.channel = channel;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public ChannelName getChannel() { return channel; }
    public void setChannel(ChannelName channel) { this.channel = channel; }

    public ConnectionStatus getStatus() { return status; }
    public void setStatus(ConnectionStatus status) { this.status = status; }

    public String getCredentialsRef() { return credentialsRef; }
    public void setCredentialsRef(String credentialsRef) { this.credentialsRef = credentialsRef; }

    public String getExternalPropertyId() { return externalPropertyId; }
    public void setExternalPropertyId(String externalPropertyId) { this.externalPropertyId = externalPropertyId; }

    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }

    public String getSyncConfig() { return syncConfig; }
    public void setSyncConfig(String syncConfig) { this.syncConfig = syncConfig; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public boolean isActive() {
        return ConnectionStatus.ACTIVE == status;
    }

    @Override
    public String toString() {
        return "ChannelConnection{id=" + id + ", channel=" + channel
                + ", orgId=" + organizationId + ", status=" + status + "}";
    }
}
