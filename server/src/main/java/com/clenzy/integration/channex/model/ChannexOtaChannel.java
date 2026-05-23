package com.clenzy.integration.channex.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;
import java.util.UUID;

/**
 * Channel OTA actif pour une property Clenzy via Channex.
 *
 * <p>Une property Channex (via {@link ChannexPropertyMapping}) peut etre
 * connectee a plusieurs OTAs simultanement (Airbnb + Booking + Vrbo).
 * Chaque connexion est un Channel dans Channex.</p>
 */
@Entity
@Table(name = "channex_ota_channels",
    indexes = {
        @Index(name = "idx_channex_ota_mapping", columnList = "property_mapping_id"),
        @Index(name = "idx_channex_ota_org", columnList = "organization_id"),
    })
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ChannexOtaChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "UUID")
    private UUID id;

    @Column(name = "property_mapping_id", nullable = false, columnDefinition = "UUID")
    private UUID propertyMappingId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /**
     * Slug OTA cote Channex. Exemples : {@code airbnb}, {@code booking_com},
     * {@code vrbo}, {@code expedia}, {@code agoda}, {@code hometogo}, {@code tripcom}.
     * La liste exhaustive evolue avec le catalogue Channex
     * (cf. <a href="https://docs.channex.io/api-reference/channels">docs.channex.io</a>).
     */
    @Column(name = "ota_type", nullable = false, length = 40)
    private String otaType;

    @Column(name = "channex_channel_id", nullable = false, length = 64)
    private String channexChannelId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "last_push_at")
    private Instant lastPushAt;

    @Column(name = "last_pull_at")
    private Instant lastPullAt;

    @Column(name = "error_count", nullable = false)
    private int errorCount = 0;

    @Column(name = "last_error_message", columnDefinition = "TEXT")
    private String lastErrorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPropertyMappingId() { return propertyMappingId; }
    public void setPropertyMappingId(UUID propertyMappingId) { this.propertyMappingId = propertyMappingId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getOtaType() { return otaType; }
    public void setOtaType(String otaType) { this.otaType = otaType; }

    public String getChannexChannelId() { return channexChannelId; }
    public void setChannexChannelId(String channexChannelId) { this.channexChannelId = channexChannelId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public Instant getLastPushAt() { return lastPushAt; }
    public void setLastPushAt(Instant lastPushAt) { this.lastPushAt = lastPushAt; }

    public Instant getLastPullAt() { return lastPullAt; }
    public void setLastPullAt(Instant lastPullAt) { this.lastPullAt = lastPullAt; }

    public int getErrorCount() { return errorCount; }
    public void setErrorCount(int errorCount) { this.errorCount = errorCount; }

    public String getLastErrorMessage() { return lastErrorMessage; }
    public void setLastErrorMessage(String lastErrorMessage) { this.lastErrorMessage = lastErrorMessage; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
