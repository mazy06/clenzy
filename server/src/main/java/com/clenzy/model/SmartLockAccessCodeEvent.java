package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Journal d'audit des codes d'acces de serrures (genere / revoque / expire /
 * delivre au voyageur / echec). Suit le meme pattern que {@link KeyExchangeEvent}.
 *
 * <p>Securite : le PIN n'est JAMAIS stocke dans {@code notes} (secret d'acces
 * physique) ; seuls l'identifiant du code et le contexte y figurent.
 */
@Entity
@Table(name = "smart_lock_access_code_event", indexes = {
    @Index(name = "idx_slace_org", columnList = "organization_id"),
    @Index(name = "idx_slace_property", columnList = "property_id"),
    @Index(name = "idx_slace_device", columnList = "device_id"),
    @Index(name = "idx_slace_reservation", columnList = "reservation_id"),
    @Index(name = "idx_slace_code", columnList = "code_id"),
    @Index(name = "idx_slace_type", columnList = "event_type"),
    @Index(name = "idx_slace_created", columnList = "created_at DESC")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class SmartLockAccessCodeEvent {

    public enum EventType {
        CODE_GENERATED, CODE_REVOKED, CODE_EXPIRED,
        CODE_DELIVERED, DELIVERY_FAILED, GENERATION_FAILED
    }

    public enum EventSource {
        AUTO_RESERVATION, MANUAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "code_id")
    private Long codeId;

    @Column(name = "device_id")
    private Long deviceId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "property_id")
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
    private EventSource source = EventSource.AUTO_RESERVATION;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

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

    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

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
}
