package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

@Entity
@Table(name = "regulatory_configs")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class RegulatoryConfig {

    public enum RegulatoryType {
        ALUR_120_DAYS,          // Loi ALUR - max 120 jours/an residences principales
        REGISTRATION_NUMBER,     // Numero d'enregistrement en mairie
        POLICE_FORM,            // Fiche de police (FR, ES, PT, IT)
        INSURANCE_CHECK,        // Verification assurance
        BAIL_MOBILITE           // Bail mobilite
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "regulatory_type", nullable = false, length = 30)
    private RegulatoryType regulatoryType;

    @Column(name = "is_enabled")
    private Boolean isEnabled = true;

    @Column(name = "registration_number", length = 50)
    private String registrationNumber;

    @Column(name = "max_days_per_year")
    private Integer maxDaysPerYear = 120;

    @Column(name = "country_code", length = 2)
    private String countryCode = "FR";

    @Column(name = "city_code", length = 10)
    private String cityCode;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public RegulatoryType getRegulatoryType() { return regulatoryType; }
    public void setRegulatoryType(RegulatoryType regulatoryType) { this.regulatoryType = regulatoryType; }
    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public Integer getMaxDaysPerYear() { return maxDaysPerYear; }
    public void setMaxDaysPerYear(Integer maxDaysPerYear) { this.maxDaysPerYear = maxDaysPerYear; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public String getCityCode() { return cityCode; }
    public void setCityCode(String cityCode) { this.cityCode = cityCode; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
