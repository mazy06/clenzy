package com.clenzy.model;

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

    @Column(name = "access_code", length = 200)
    private String accessCode;

    @Column(name = "wifi_name", length = 200)
    private String wifiName;

    @Column(name = "wifi_password", length = 200)
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

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
