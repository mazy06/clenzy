package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entité JPA représentant un flux iCal associé à une propriété.
 * Stocke l'URL du calendrier externe (Airbnb, Booking, Vrbo, etc.)
 * et les paramètres de synchronisation automatique.
 */
@Entity
@Table(name = "ical_feeds", indexes = {
    @Index(name = "idx_ical_feed_property_id", columnList = "property_id"),
    @Index(name = "idx_ical_feed_sync_enabled", columnList = "sync_enabled")
})
@org.hibernate.annotations.FilterDef(
    name = "organizationFilter",
    parameters = @org.hibernate.annotations.ParamDef(name = "orgId", type = Long.class)
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ICalFeed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "property_id", insertable = false, updatable = false)
    private Long propertyId;

    @Column(name = "url", nullable = false, length = 1000)
    private String url;

    @Column(name = "source_name", nullable = false, length = 50)
    private String sourceName;

    @Column(name = "auto_create_interventions", nullable = false)
    private boolean autoCreateInterventions = false;

    @Column(name = "sync_enabled", nullable = false)
    private boolean syncEnabled = true;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_sync_status", length = 20)
    private String lastSyncStatus = "NEVER";

    @Column(name = "last_sync_error", columnDefinition = "TEXT")
    private String lastSyncError;

    @Column(name = "events_imported", nullable = false)
    private int eventsImported = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public ICalFeed() {}

    public ICalFeed(Property property, String url, String sourceName) {
        this.property = property;
        this.url = url;
        this.sourceName = sourceName;
    }

    // Lifecycle callbacks
    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
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

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public boolean isAutoCreateInterventions() { return autoCreateInterventions; }
    public void setAutoCreateInterventions(boolean autoCreateInterventions) { this.autoCreateInterventions = autoCreateInterventions; }

    public boolean isSyncEnabled() { return syncEnabled; }
    public void setSyncEnabled(boolean syncEnabled) { this.syncEnabled = syncEnabled; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getLastSyncStatus() { return lastSyncStatus; }
    public void setLastSyncStatus(String lastSyncStatus) { this.lastSyncStatus = lastSyncStatus; }

    public String getLastSyncError() { return lastSyncError; }
    public void setLastSyncError(String lastSyncError) { this.lastSyncError = lastSyncError; }

    public int getEventsImported() { return eventsImported; }
    public void setEventsImported(int eventsImported) { this.eventsImported = eventsImported; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "ICalFeed{" +
                "id=" + id +
                ", propertyId=" + propertyId +
                ", sourceName='" + sourceName + '\'' +
                ", syncEnabled=" + syncEnabled +
                ", autoCreateInterventions=" + autoCreateInterventions +
                ", lastSyncStatus='" + lastSyncStatus + '\'' +
                '}';
    }
}
