package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Evenement guest sur la page publique du livret (ouverture, clic activite, message
 * chatbot, avis, clic check-in). Table append-only, toujours interrogee par
 * {@code guide_id} + org explicite (pas de filtre tenant Hibernate). Alimente les
 * statistiques cote hote ({@code WelcomeGuideAnalyticsService}).
 */
@Entity
@Table(name = "welcome_guide_events", indexes = {
        @Index(name = "idx_wg_events_guide", columnList = "guide_id"),
        @Index(name = "idx_wg_events_guide_type", columnList = "guide_id, event_type"),
        @Index(name = "idx_wg_events_created", columnList = "created_at")
})
public class WelcomeGuideEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "guide_id", nullable = false)
    private Long guideId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    private WelcomeGuideEventType eventType;

    /** Detail optionnel (ex: nom de l'activite cliquee). */
    @Column(length = 255)
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public WelcomeGuideEvent() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getGuideId() { return guideId; }
    public void setGuideId(Long guideId) { this.guideId = guideId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public WelcomeGuideEventType getEventType() { return eventType; }
    public void setEventType(WelcomeGuideEventType eventType) { this.eventType = eventType; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
