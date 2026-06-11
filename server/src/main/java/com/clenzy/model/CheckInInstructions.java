package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Instructions check-in/check-out pour une propriete.
 * Relation 1:1 avec Property. Stocke les informations d'acces,
 * WiFi, parking, regles et contact d'urgence.
 */
@Entity
@Table(name = "check_in_instructions")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class CheckInInstructions {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false, insertable = false, updatable = false)
    private Long propertyId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false, unique = true)
    private Property property;

    /** Code d'acces statique — secret d'acces physique, CHIFFRE au repos (M1-MODEL-04,
     *  aligne sur {@link SmartLockAccessCode#getCode()}). Colonne TEXT (le ciphertext
     *  Jasypt depasse l'ancien varchar(200)), voir changeset 0233. */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "access_code", columnDefinition = "TEXT")
    private String accessCode;

    @Column(name = "wifi_name", length = 200)
    private String wifiName;

    /** Mot de passe WiFi — secret, CHIFFRE au repos (M1-MODEL-04). Colonne TEXT, voir changeset 0233. */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "wifi_password", columnDefinition = "TEXT")
    private String wifiPassword;

    @Column(name = "parking_info", columnDefinition = "TEXT")
    private String parkingInfo;

    @Column(name = "arrival_instructions", columnDefinition = "TEXT")
    private String arrivalInstructions;

    @Column(name = "departure_instructions", columnDefinition = "TEXT")
    private String departureInstructions;

    @Column(name = "house_rules", columnDefinition = "TEXT")
    private String houseRules;

    @Column(name = "emergency_contact", length = 500)
    private String emergencyContact;

    @Column(name = "additional_notes", columnDefinition = "TEXT")
    private String additionalNotes;

    /** Photos d'indication d'acces (JSON : [{key, caption}]). Pass-through, servi a la page guest. */
    @Column(name = "arrival_photos", columnDefinition = "JSONB", nullable = false)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String arrivalPhotos = "[]";

    /**
     * Codes additionnels libres (JSON : [{label, code}]) — résidence, immeuble, parking…
     *
     * <p>Ces valeurs sont des secrets d'accès physique : le blob JSON entier est
     * CHIFFRE au repos (M1-MODEL-04). La colonne passe donc de {@code JSONB} à
     * {@code TEXT} (changeset 0233) — on ne peut pas stocker du ciphertext Jasypt
     * dans une colonne {@code jsonb} (le type Postgres rejette le non-JSON). Le
     * contenu reste un JSON applicatif (parse côté service / DTO), servi déchiffré
     * transparemment par le converter. {@code nullable=false} conservé : le défaut
     * {@code "[]"} est chiffré comme toute autre valeur (jamais null/vide).</p>
     */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "extra_access_codes", columnDefinition = "TEXT", nullable = false)
    private String extraAccessCodes = "[]";

    /** Régénère automatiquement le code d'accès statique après chaque départ (opt-in par logement). */
    @Column(name = "access_code_auto_rotate", nullable = false)
    private boolean accessCodeAutoRotate = false;

    /** Format JSON ({pattern, letters, symbols}) du générateur, pour régénérer un code cohérent côté serveur. */
    @Column(name = "access_code_format", length = 500)
    private String accessCodeFormat;

    /** Dernière rotation automatique du code (idempotence du scheduler). */
    @Column(name = "access_code_rotated_at")
    private LocalDateTime accessCodeRotatedAt;

    /** Autorise le voyageur à ouvrir la porte depuis le livret (serrure pilotable à distance). */
    @Column(name = "guest_unlock_enabled", nullable = false)
    private boolean guestUnlockEnabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public CheckInInstructions() {}

    public CheckInInstructions(Property property, Long organizationId) {
        this.property = property;
        this.organizationId = organizationId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public String getAccessCode() { return accessCode; }
    public void setAccessCode(String accessCode) { this.accessCode = accessCode; }

    public String getWifiName() { return wifiName; }
    public void setWifiName(String wifiName) { this.wifiName = wifiName; }

    public String getWifiPassword() { return wifiPassword; }
    public void setWifiPassword(String wifiPassword) { this.wifiPassword = wifiPassword; }

    public String getParkingInfo() { return parkingInfo; }
    public void setParkingInfo(String parkingInfo) { this.parkingInfo = parkingInfo; }

    public String getArrivalInstructions() { return arrivalInstructions; }
    public void setArrivalInstructions(String arrivalInstructions) { this.arrivalInstructions = arrivalInstructions; }

    public String getDepartureInstructions() { return departureInstructions; }
    public void setDepartureInstructions(String departureInstructions) { this.departureInstructions = departureInstructions; }

    public String getHouseRules() { return houseRules; }
    public void setHouseRules(String houseRules) { this.houseRules = houseRules; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public String getAdditionalNotes() { return additionalNotes; }
    public void setAdditionalNotes(String additionalNotes) { this.additionalNotes = additionalNotes; }

    public String getArrivalPhotos() { return arrivalPhotos; }
    public void setArrivalPhotos(String arrivalPhotos) { this.arrivalPhotos = arrivalPhotos; }

    public String getExtraAccessCodes() { return extraAccessCodes; }
    public void setExtraAccessCodes(String extraAccessCodes) { this.extraAccessCodes = extraAccessCodes; }

    public boolean isAccessCodeAutoRotate() { return accessCodeAutoRotate; }
    public void setAccessCodeAutoRotate(boolean accessCodeAutoRotate) { this.accessCodeAutoRotate = accessCodeAutoRotate; }

    public String getAccessCodeFormat() { return accessCodeFormat; }
    public void setAccessCodeFormat(String accessCodeFormat) { this.accessCodeFormat = accessCodeFormat; }

    public LocalDateTime getAccessCodeRotatedAt() { return accessCodeRotatedAt; }
    public void setAccessCodeRotatedAt(LocalDateTime accessCodeRotatedAt) { this.accessCodeRotatedAt = accessCodeRotatedAt; }

    public boolean isGuestUnlockEnabled() { return guestUnlockEnabled; }
    public void setGuestUnlockEnabled(boolean guestUnlockEnabled) { this.guestUnlockEnabled = guestUnlockEnabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
