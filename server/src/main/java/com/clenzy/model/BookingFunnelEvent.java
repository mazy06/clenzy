package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Événement de funnel du booking engine (fondations RMS R1) — capturé
 * SERVER-SIDE par {@code BookingFunnelRecorder} sur les endpoints publics
 * existants. Append-only. Le {@code payload} ne contient JAMAIS de PII :
 * les clés sont whitelistées à l'écriture (dates, voyageurs, propriété, nuits).
 */
@Entity
@Table(name = "booking_funnel_events")
public class BookingFunnelEvent {

    /** Types d'événements — SEARCH_NO_RESULT = denied demand, le signal RMS clé. */
    public enum Type { SEARCH, SEARCH_NO_RESULT, VIEW_PROPERTY, CHECKOUT_START }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "engine_config_id")
    private Long engineConfigId;

    /** Identifiant opaque de session SDK (aléatoire, jamais de PII) — optionnel. */
    @Column(name = "session_key", length = 64)
    private String sessionKey;

    @Column(name = "event_type", nullable = false, length = 24)
    private String eventType;

    @Column(name = "property_id")
    private Long propertyId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime occurredAt;

    public BookingFunnelEvent() {
    }

    public BookingFunnelEvent(Long organizationId, Long engineConfigId, String sessionKey,
                              Type type, Long propertyId, Map<String, Object> payload) {
        this.organizationId = organizationId;
        this.engineConfigId = engineConfigId;
        this.sessionKey = sessionKey;
        this.eventType = type.name();
        this.propertyId = propertyId;
        this.payload = payload;
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public Long getEngineConfigId() { return engineConfigId; }
    public String getSessionKey() { return sessionKey; }
    public String getEventType() { return eventType; }
    public Long getPropertyId() { return propertyId; }
    public Map<String, Object> getPayload() { return payload; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
}
