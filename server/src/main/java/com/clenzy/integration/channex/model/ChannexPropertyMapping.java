package com.clenzy.integration.channex.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;
import java.util.UUID;

/**
 * Mapping entre une property Clenzy et son equivalent Channex
 * (property + room_type + rate_plan).
 *
 * <p>Multi-tenant via filtre Hibernate sur {@code organization_id}.</p>
 *
 * <p>Voir {@code docs/strategy/channex-integration-plan.md} Sprint 2 pour
 * la justification du modele a 3 IDs (Channex impose property -> room_type
 * -> rate_plan comme hierarchie obligatoire).</p>
 */
@Entity
@Table(name = "channex_property_mapping",
    indexes = {
        @Index(name = "idx_channex_mapping_org", columnList = "organization_id"),
        @Index(name = "idx_channex_mapping_clenzy_prop", columnList = "clenzy_property_id"),
    })
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ChannexPropertyMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "UUID")
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "clenzy_property_id", nullable = false)
    private Long clenzyPropertyId;

    @Column(name = "channex_property_id", nullable = false, length = 64)
    private String channexPropertyId;

    @Column(name = "channex_room_type_id", nullable = false, length = 64)
    private String channexRoomTypeId;

    @Column(name = "channex_default_rate_plan_id", nullable = false, length = 64)
    private String channexDefaultRatePlanId;

    /** Rate plans additionnels (au-dela du defaut) cibles par la sync, en CSV. Permet de mapper
     * une propriete a plusieurs rate plans Channex (ex : remboursable + non-remboursable). */
    @Column(name = "channex_rate_plan_ids", length = 512)
    private String channexRatePlanIds;

    /** Stocke en lowercase ('pending'/'active'/'error'/'disabled') pour matcher le CHECK SQL. */
    @Column(name = "sync_status", nullable = false, length = 20)
    private String syncStatus = "pending";

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "last_sync_error", columnDefinition = "TEXT")
    private String lastSyncError;

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

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getClenzyPropertyId() { return clenzyPropertyId; }
    public void setClenzyPropertyId(Long clenzyPropertyId) { this.clenzyPropertyId = clenzyPropertyId; }

    public String getChannexPropertyId() { return channexPropertyId; }
    public void setChannexPropertyId(String channexPropertyId) { this.channexPropertyId = channexPropertyId; }

    public String getChannexRoomTypeId() { return channexRoomTypeId; }
    public void setChannexRoomTypeId(String channexRoomTypeId) { this.channexRoomTypeId = channexRoomTypeId; }

    public String getChannexDefaultRatePlanId() { return channexDefaultRatePlanId; }
    public void setChannexDefaultRatePlanId(String channexDefaultRatePlanId) {
        this.channexDefaultRatePlanId = channexDefaultRatePlanId;
    }

    public String getChannexRatePlanIds() { return channexRatePlanIds; }
    public void setChannexRatePlanIds(String channexRatePlanIds) {
        this.channexRatePlanIds = channexRatePlanIds;
    }

    /** Rate plans cibles de la sync : le defaut + les additionnels (dedup, defaut en premier). */
    public java.util.List<String> getTargetRatePlanIds() {
        java.util.LinkedHashSet<String> ids = new java.util.LinkedHashSet<>();
        if (channexDefaultRatePlanId != null && !channexDefaultRatePlanId.isBlank()) {
            ids.add(channexDefaultRatePlanId.trim());
        }
        if (channexRatePlanIds != null && !channexRatePlanIds.isBlank()) {
            for (String s : channexRatePlanIds.split(",")) {
                if (s != null && !s.isBlank()) ids.add(s.trim());
            }
        }
        return new java.util.ArrayList<>(ids);
    }

    public ChannexSyncStatus getSyncStatus() { return ChannexSyncStatus.fromDb(syncStatus); }
    public void setSyncStatus(ChannexSyncStatus syncStatus) {
        this.syncStatus = syncStatus.toDb();
    }

    public Instant getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(Instant lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getLastSyncError() { return lastSyncError; }
    public void setLastSyncError(String lastSyncError) { this.lastSyncError = lastSyncError; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
