package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Camera connectee (Phase 2). Org-scopee via le filtre Hibernate, comme les
 * autres objets connectes. L'URL RTSP (avec credentials) est stockee chiffree
 * ({@code rtspUrlEncrypted}). Le flux est servi par la passerelle media go2rtc
 * sous l'identifiant {@code streamName}.
 */
@Entity
@Table(name = "cameras", indexes = {
    @Index(name = "idx_cameras_org_id", columnList = "organization_id"),
    @Index(name = "idx_cameras_property_id", columnList = "property_id"),
    @Index(name = "idx_cameras_user_id", columnList = "user_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Camera {

    public enum CameraStatus {
        ACTIVE, INACTIVE, PENDING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "room_name")
    private String roomName;

    @Column(name = "brand", length = 50)
    private String brand;

    /** URL RTSP source (avec credentials), chiffree AES-256-GCM. */
    @Column(name = "rtsp_url_encrypted", columnDefinition = "TEXT")
    private String rtspUrlEncrypted;

    /** Identifiant du flux cote go2rtc (unique). */
    @Column(name = "stream_name", nullable = false, length = 120)
    private String streamName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CameraStatus status = CameraStatus.ACTIVE;

    @Column(name = "recording", nullable = false)
    private boolean recording = false;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ─── Relations ──────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", insertable = false, updatable = false)
    private Property property;

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

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getRtspUrlEncrypted() { return rtspUrlEncrypted; }
    public void setRtspUrlEncrypted(String rtspUrlEncrypted) { this.rtspUrlEncrypted = rtspUrlEncrypted; }

    public String getStreamName() { return streamName; }
    public void setStreamName(String streamName) { this.streamName = streamName; }

    public CameraStatus getStatus() { return status; }
    public void setStatus(CameraStatus status) { this.status = status; }

    public boolean isRecording() { return recording; }
    public void setRecording(boolean recording) { this.recording = recording; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Property getProperty() { return property; }
}
