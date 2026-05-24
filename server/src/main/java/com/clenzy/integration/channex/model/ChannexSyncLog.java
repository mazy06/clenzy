package com.clenzy.integration.channex.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entree d'historique pour une operation de sync Channex — Phase 3.
 *
 * <p>Persiste cote DB pour pouvoir consulter depuis l'UI Clenzy "que s'est-il
 * passe lors du dernier push de cette property ?", au lieu de devoir grep les
 * logs applicatifs.</p>
 *
 * <p>Pas de {@code @Filter(organizationFilter)} pour permettre au watchdog
 * cross-tenant de lire (les endpoints user-facing scopent eux-memes via le
 * tenantContext + queries explicites org_id).</p>
 */
@Entity
@Table(name = "channex_sync_logs")
public class ChannexSyncLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "clenzy_property_id", nullable = false)
    private Long clenzyPropertyId;

    @Column(name = "mapping_id")
    private UUID mappingId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_type", nullable = false, length = 40)
    private SyncType syncType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    @Column(name = "record_count", nullable = false)
    private int recordCount = 0;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs = 0L;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    public enum SyncType {
        PUSH_AVAILABILITY,
        PUSH_RATES,
        PUSH_PROPERTY,
        PULL_BOOKINGS,
        RESYNC_CONTENT
    }

    public enum Status { SUCCESS, FAIL, SKIPPED }

    // ─── Getters / setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getClenzyPropertyId() { return clenzyPropertyId; }
    public void setClenzyPropertyId(Long clenzyPropertyId) { this.clenzyPropertyId = clenzyPropertyId; }

    public UUID getMappingId() { return mappingId; }
    public void setMappingId(UUID mappingId) { this.mappingId = mappingId; }

    public SyncType getSyncType() { return syncType; }
    public void setSyncType(SyncType syncType) { this.syncType = syncType; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public int getRecordCount() { return recordCount; }
    public void setRecordCount(int recordCount) { this.recordCount = recordCount; }

    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
}
