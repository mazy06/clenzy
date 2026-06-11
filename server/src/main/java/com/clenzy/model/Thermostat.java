package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thermostat connecte (Phase 2). Org-scope via le filtre Hibernate, comme les
 * autres objets connectes. Reutilise l'integration Tuya ({@code externalDeviceId}
 * = device Tuya). Les valeurs (temperature/humidite/mode) sont mises en cache et
 * rafraichies a la demande via l'API Tuya (meme pattern que SmartLockDevice).
 */
@Entity
@Table(name = "thermostats", indexes = {
    @Index(name = "idx_thermostats_org_id", columnList = "organization_id"),
    @Index(name = "idx_thermostats_property_id", columnList = "property_id"),
    @Index(name = "idx_thermostats_user_id", columnList = "user_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Thermostat {

    public enum ThermostatStatus {
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

    @Column(name = "brand", length = 20)
    private String brand = "TUYA";

    @Column(name = "external_device_id")
    private String externalDeviceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ThermostatStatus status = ThermostatStatus.ACTIVE;

    /** Temperature mesuree (°C), en cache. */
    @Column(name = "current_temp_c")
    private BigDecimal currentTempC;

    /** Consigne (°C), en cache. */
    @Column(name = "target_temp_c")
    private BigDecimal targetTempC;

    /** Humidite relative (%), en cache. */
    @Column(name = "humidity")
    private Integer humidity;

    /** Mode normalise : heat | cool | eco | off. */
    @Column(name = "mode", length = 20)
    private String mode;

    @Column(name = "preset", length = 50)
    private String preset;

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

    public String getExternalDeviceId() { return externalDeviceId; }
    public void setExternalDeviceId(String externalDeviceId) { this.externalDeviceId = externalDeviceId; }

    public ThermostatStatus getStatus() { return status; }
    public void setStatus(ThermostatStatus status) { this.status = status; }

    public BigDecimal getCurrentTempC() { return currentTempC; }
    public void setCurrentTempC(BigDecimal currentTempC) { this.currentTempC = currentTempC; }

    public BigDecimal getTargetTempC() { return targetTempC; }
    public void setTargetTempC(BigDecimal targetTempC) { this.targetTempC = targetTempC; }

    public Integer getHumidity() { return humidity; }
    public void setHumidity(Integer humidity) { this.humidity = humidity; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getPreset() { return preset; }
    public void setPreset(String preset) { this.preset = preset; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Property getProperty() { return property; }
}
