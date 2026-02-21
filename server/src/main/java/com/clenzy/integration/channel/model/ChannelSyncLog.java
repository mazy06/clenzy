package com.clenzy.integration.channel.model;

import com.clenzy.integration.channel.SyncDirection;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Log d'audit des operations de synchronisation channel.
 * Chaque sync INBOUND ou OUTBOUND est tracee ici.
 *
 * PAS de @Filter organizationFilter : consultable cross-org par SUPER_ADMIN.
 */
@Entity
@Table(name = "channel_sync_log")
public class ChannelSyncLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "connection_id", nullable = false)
    private ChannelConnection connection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapping_id")
    private ChannelMapping mapping;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SyncDirection direction;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // Constructeurs
    public ChannelSyncLog() {}

    public ChannelSyncLog(Long organizationId, ChannelConnection connection,
                          SyncDirection direction, String eventType, String status) {
        this.organizationId = organizationId;
        this.connection = connection;
        this.direction = direction;
        this.eventType = eventType;
        this.status = status;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public ChannelConnection getConnection() { return connection; }
    public void setConnection(ChannelConnection connection) { this.connection = connection; }

    public ChannelMapping getMapping() { return mapping; }
    public void setMapping(ChannelMapping mapping) { this.mapping = mapping; }

    public SyncDirection getDirection() { return direction; }
    public void setDirection(SyncDirection direction) { this.direction = direction; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
