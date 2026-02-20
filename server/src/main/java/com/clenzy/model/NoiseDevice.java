package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "noise_devices", indexes = {
    @Index(name = "idx_noise_device_user_id", columnList = "user_id"),
    @Index(name = "idx_noise_device_property_id", columnList = "property_id"),
    @Index(name = "idx_noise_device_type", columnList = "device_type"),
    @Index(name = "idx_noise_device_status", columnList = "status")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class NoiseDevice {

    public enum DeviceType {
        MINUT, TUYA
    }

    public enum DeviceStatus {
        ACTIVE, INACTIVE, PENDING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_type", nullable = false, length = 10)
    private DeviceType deviceType;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "room_name")
    private String roomName;

    @Column(name = "external_device_id")
    private String externalDeviceId;

    @Column(name = "external_home_id")
    private String externalHomeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeviceStatus status = DeviceStatus.ACTIVE;

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

    public DeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(DeviceType deviceType) { this.deviceType = deviceType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }

    public String getExternalDeviceId() { return externalDeviceId; }
    public void setExternalDeviceId(String externalDeviceId) { this.externalDeviceId = externalDeviceId; }

    public String getExternalHomeId() { return externalHomeId; }
    public void setExternalHomeId(String externalHomeId) { this.externalHomeId = externalHomeId; }

    public DeviceStatus getStatus() { return status; }
    public void setStatus(DeviceStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Property getProperty() { return property; }

    /**
     * Label pour le graphique : "PropertyName - RoomName" ou "PropertyName"
     */
    public String getChartLabel() {
        if (property == null) return name;
        String base = property.getName();
        return roomName != null && !roomName.isEmpty() ? base + " - " + roomName : base;
    }
}
