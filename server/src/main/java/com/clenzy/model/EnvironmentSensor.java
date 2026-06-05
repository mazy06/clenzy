package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Capteur d'environnement connecte (temperature/humidite, contact porte/fenetre,
 * mouvement PIR, fumee/vape). Modele generique unique pour les 4 types du
 * catalogue (discriminant {@link SensorType}) — evite 4 tables/services dupliques.
 * Org-scope via le filtre Hibernate, comme les autres objets connectes. Reutilise
 * l'integration Tuya ({@code externalDeviceId}) ; l'etat est mis en cache et
 * rafraichi a la demande / par scheduler (meme pattern que {@link Thermostat}).
 */
@Entity
@Table(name = "environment_sensors", indexes = {
    @Index(name = "idx_environment_sensors_org_id", columnList = "organization_id"),
    @Index(name = "idx_environment_sensors_property_id", columnList = "property_id"),
    @Index(name = "idx_environment_sensors_user_id", columnList = "user_id"),
    @Index(name = "idx_environment_sensors_type", columnList = "sensor_type")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class EnvironmentSensor {

    /** Type de capteur (discriminant). Pilote le parsing Tuya et la metrique affichee. */
    public enum SensorType {
        TEMP_HUMIDITY, CONTACT, MOTION, SMOKE
    }

    public enum SensorStatus {
        ACTIVE, INACTIVE, PENDING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "room_name")
    private String roomName;

    @Enumerated(EnumType.STRING)
    @Column(name = "sensor_type", nullable = false, length = 20)
    private SensorType sensorType;

    @Column(name = "brand", length = 20)
    private String brand = "TUYA";

    @Column(name = "external_device_id")
    private String externalDeviceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SensorStatus status = SensorStatus.ACTIVE;

    /** Connectivite reelle (flag Tuya). NULL = jamais synchronise. */
    @Column(name = "online")
    private Boolean online;

    @Column(name = "battery_level")
    private Integer batteryLevel;

    /** TEMP_HUMIDITY : temperature mesuree (°C), en cache. */
    @Column(name = "temperature_c")
    private BigDecimal temperatureC;

    /** TEMP_HUMIDITY : humidite relative (%), en cache. */
    @Column(name = "humidity")
    private Integer humidity;

    /** CONTACT : true = ouvert. */
    @Column(name = "contact_open")
    private Boolean contactOpen;

    /** MOTION : true = mouvement detecte. */
    @Column(name = "motion_detected")
    private Boolean motionDetected;

    /** SMOKE : true = fumee/vape detectee. */
    @Column(name = "smoke_detected")
    private Boolean smokeDetected;

    /** Station meteo (Netatmo) : CO2 (ppm). */
    @Column(name = "co2")
    private Integer co2;

    /** Station meteo (Netatmo) : niveau sonore (dB). */
    @Column(name = "noise_db")
    private Integer noiseDb;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    /** Dernier changement d'etat detecte (ouverture, mouvement, fumee). */
    @Column(name = "last_event_at")
    private LocalDateTime lastEventAt;

    /** Derniere notification envoyee (cooldown anti-spam). */
    @Column(name = "last_alert_at")
    private LocalDateTime lastAlertAt;

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

    public SensorType getSensorType() { return sensorType; }
    public void setSensorType(SensorType sensorType) { this.sensorType = sensorType; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getExternalDeviceId() { return externalDeviceId; }
    public void setExternalDeviceId(String externalDeviceId) { this.externalDeviceId = externalDeviceId; }

    public SensorStatus getStatus() { return status; }
    public void setStatus(SensorStatus status) { this.status = status; }

    public Boolean getOnline() { return online; }
    public void setOnline(Boolean online) { this.online = online; }

    public Integer getBatteryLevel() { return batteryLevel; }
    public void setBatteryLevel(Integer batteryLevel) { this.batteryLevel = batteryLevel; }

    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal temperatureC) { this.temperatureC = temperatureC; }

    public Integer getHumidity() { return humidity; }
    public void setHumidity(Integer humidity) { this.humidity = humidity; }

    public Boolean getContactOpen() { return contactOpen; }
    public void setContactOpen(Boolean contactOpen) { this.contactOpen = contactOpen; }

    public Boolean getMotionDetected() { return motionDetected; }
    public void setMotionDetected(Boolean motionDetected) { this.motionDetected = motionDetected; }

    public Boolean getSmokeDetected() { return smokeDetected; }
    public void setSmokeDetected(Boolean smokeDetected) { this.smokeDetected = smokeDetected; }

    public Integer getCo2() { return co2; }
    public void setCo2(Integer co2) { this.co2 = co2; }

    public Integer getNoiseDb() { return noiseDb; }
    public void setNoiseDb(Integer noiseDb) { this.noiseDb = noiseDb; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public LocalDateTime getLastEventAt() { return lastEventAt; }
    public void setLastEventAt(LocalDateTime lastEventAt) { this.lastEventAt = lastEventAt; }

    public LocalDateTime getLastAlertAt() { return lastAlertAt; }
    public void setLastAlertAt(LocalDateTime lastAlertAt) { this.lastAlertAt = lastAlertAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Property getProperty() { return property; }
}
