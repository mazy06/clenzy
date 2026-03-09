package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "key_exchange_events", indexes = {
    @Index(name = "idx_kee_org", columnList = "organization_id"),
    @Index(name = "idx_kee_property", columnList = "property_id"),
    @Index(name = "idx_kee_point", columnList = "point_id"),
    @Index(name = "idx_kee_code", columnList = "code_id"),
    @Index(name = "idx_kee_type", columnList = "event_type"),
    @Index(name = "idx_kee_created", columnList = "created_at DESC")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class KeyExchangeEvent {

    // ─── Enums ──────────────────────────────────────────────────

    public enum EventType {
        KEY_DEPOSITED, KEY_COLLECTED, KEY_RETURNED,
        CODE_GENERATED, CODE_CANCELLED, CODE_EXPIRED
    }

    public enum EventSource {
        MANUAL, WEBHOOK, API_POLL, PUBLIC_PAGE
    }

    // ─── Fields ─────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "code_id")
    private Long codeId;

    @Column(name = "point_id")
    private Long pointId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private EventType eventType;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private EventSource source = EventSource.MANUAL;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ─── Relations ──────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "code_id", insertable = false, updatable = false)
    private KeyExchangeCode exchangeCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "point_id", insertable = false, updatable = false)
    private KeyExchangePoint exchangePoint;

    // ─── Lifecycle ──────────────────────────────────────────────

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getCodeId() { return codeId; }
    public void setCodeId(Long codeId) { this.codeId = codeId; }

    public Long getPointId() { return pointId; }
    public void setPointId(Long pointId) { this.pointId = pointId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public EventType getEventType() { return eventType; }
    public void setEventType(EventType eventType) { this.eventType = eventType; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public EventSource getSource() { return source; }
    public void setSource(EventSource source) { this.source = source; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public KeyExchangeCode getExchangeCode() { return exchangeCode; }
    public KeyExchangePoint getExchangePoint() { return exchangePoint; }
}
