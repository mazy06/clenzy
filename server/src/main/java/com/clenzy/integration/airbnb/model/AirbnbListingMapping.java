package com.clenzy.integration.airbnb.model;

import com.clenzy.model.Property;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * JPA entity linking a Clenzy Property to an Airbnb listing.
 * Manages synchronization settings and cached listing metadata.
 */
@Entity
@Table(name = "airbnb_listing_mappings", indexes = {
    @Index(name = "idx_listing_map_property_id", columnList = "property_id"),
    @Index(name = "idx_listing_map_airbnb_listing_id", columnList = "airbnb_listing_id", unique = true)
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class AirbnbListingMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "property_id", nullable = false, insertable = false, updatable = false)
    private Long propertyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "airbnb_listing_id", nullable = false, unique = true)
    private String airbnbListingId;

    @Column(name = "airbnb_listing_title")
    private String airbnbListingTitle;

    @Column(name = "airbnb_listing_url")
    private String airbnbListingUrl;

    @Column(name = "sync_enabled", nullable = false)
    private boolean syncEnabled = true;

    @Column(name = "auto_create_interventions", nullable = false)
    private boolean autoCreateInterventions = true;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public AirbnbListingMapping() {
    }

    public AirbnbListingMapping(Property property, String airbnbListingId) {
        this.property = property;
        this.airbnbListingId = airbnbListingId;
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

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public String getAirbnbListingId() {
        return airbnbListingId;
    }

    public void setAirbnbListingId(String airbnbListingId) {
        this.airbnbListingId = airbnbListingId;
    }

    public String getAirbnbListingTitle() {
        return airbnbListingTitle;
    }

    public void setAirbnbListingTitle(String airbnbListingTitle) {
        this.airbnbListingTitle = airbnbListingTitle;
    }

    public String getAirbnbListingUrl() {
        return airbnbListingUrl;
    }

    public void setAirbnbListingUrl(String airbnbListingUrl) {
        this.airbnbListingUrl = airbnbListingUrl;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public void setSyncEnabled(boolean syncEnabled) {
        this.syncEnabled = syncEnabled;
    }

    public boolean isAutoCreateInterventions() {
        return autoCreateInterventions;
    }

    public void setAutoCreateInterventions(boolean autoCreateInterventions) {
        this.autoCreateInterventions = autoCreateInterventions;
    }

    public LocalDateTime getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(LocalDateTime lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
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

    @Override
    public String toString() {
        return "AirbnbListingMapping{" +
                "id=" + id +
                ", propertyId=" + propertyId +
                ", airbnbListingId='" + airbnbListingId + '\'' +
                ", syncEnabled=" + syncEnabled +
                ", autoCreateInterventions=" + autoCreateInterventions +
                '}';
    }
}
