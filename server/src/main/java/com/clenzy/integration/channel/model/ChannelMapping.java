package com.clenzy.integration.channel.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Mapping generique entre une entite PMS (property) et une entite channel (listing).
 *
 * Exemples :
 * - Property 42 <-> Airbnb listing "abc123"
 * - Property 42 <-> iCal feed URL (external_id = URL)
 * - Property 42 <-> Booking.com property "789"
 */
@Entity
@Table(name = "channel_mappings")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ChannelMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "connection_id", nullable = false)
    private ChannelConnection connection;

    @Column(name = "entity_type", nullable = false, length = 30)
    private String entityType = "PROPERTY";

    @Column(name = "internal_id", nullable = false)
    private Long internalId;

    @Column(name = "external_id", nullable = false, length = 200)
    private String externalId;

    @Column(name = "mapping_config", columnDefinition = "JSONB")
    private String mappingConfig;

    @Column(name = "sync_enabled", nullable = false)
    private boolean syncEnabled = true;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_sync_status", length = 30)
    private String lastSyncStatus;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs
    public ChannelMapping() {}

    public ChannelMapping(ChannelConnection connection, Long internalId,
                          String externalId, Long organizationId) {
        this.connection = connection;
        this.internalId = internalId;
        this.externalId = externalId;
        this.organizationId = organizationId;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ChannelConnection getConnection() { return connection; }
    public void setConnection(ChannelConnection connection) { this.connection = connection; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public Long getInternalId() { return internalId; }
    public void setInternalId(Long internalId) { this.internalId = internalId; }

    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }

    public String getMappingConfig() { return mappingConfig; }
    public void setMappingConfig(String mappingConfig) { this.mappingConfig = mappingConfig; }

    public boolean isSyncEnabled() { return syncEnabled; }
    public void setSyncEnabled(boolean syncEnabled) { this.syncEnabled = syncEnabled; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getLastSyncStatus() { return lastSyncStatus; }
    public void setLastSyncStatus(String lastSyncStatus) { this.lastSyncStatus = lastSyncStatus; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "ChannelMapping{id=" + id
                + ", entityType='" + entityType + "'"
                + ", internalId=" + internalId
                + ", externalId='" + externalId + "'"
                + ", syncEnabled=" + syncEnabled + "}";
    }
}
