package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Licence ou autorisation administrative d'un logement (licence courte durée,
 * enregistrement touristique, certificat de sécurité…). L'échéance
 * {@link #expiresAt} et le délai {@link #renewalLeadDays} alimentent la carte
 * {@code LICENSE_RENEWAL} de la constellation (agent Conformité).
 */
@Entity
@Table(name = "property_licenses")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PropertyLicense {

    public enum LicenseType {
        SHORT_TERM_RENTAL,
        TOURISM_REGISTRATION,
        SAFETY_CERT,
        OTHER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "license_type", nullable = false, length = 40)
    private LicenseType licenseType = LicenseType.OTHER;

    @Column(name = "license_number", length = 120)
    private String licenseNumber;

    @Column(name = "issued_by", length = 200)
    private String issuedBy;

    @Column(name = "issued_at")
    private LocalDate issuedAt;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    /** Délai d'alerte avant échéance (jours) — la carte se lève à J-{lead}. */
    @Column(name = "renewal_lead_days", nullable = false)
    private int renewalLeadDays = 60;

    /** Clé de stockage du scan (PhotoStorage/S3), null si aucun document joint. */
    @Column(name = "document_ref", length = 500)
    private String documentRef;

    @Column(length = 1000)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public LicenseType getLicenseType() { return licenseType; }
    public void setLicenseType(LicenseType licenseType) { this.licenseType = licenseType; }
    public String getLicenseNumber() { return licenseNumber; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }
    public String getIssuedBy() { return issuedBy; }
    public void setIssuedBy(String issuedBy) { this.issuedBy = issuedBy; }
    public LocalDate getIssuedAt() { return issuedAt; }
    public void setIssuedAt(LocalDate issuedAt) { this.issuedAt = issuedAt; }
    public LocalDate getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDate expiresAt) { this.expiresAt = expiresAt; }
    public int getRenewalLeadDays() { return renewalLeadDays; }
    public void setRenewalLeadDays(int renewalLeadDays) { this.renewalLeadDays = renewalLeadDays; }
    public String getDocumentRef() { return documentRef; }
    public void setDocumentRef(String documentRef) { this.documentRef = documentRef; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
