package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "prospects")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Prospect {

    // ─── Enums ──────────────────────────────────────────────────────────────────

    public enum ProspectCategory {
        CONCIERGERIES,
        MENAGE,
        ARTISANS,
        ENTRETIEN,
        BLANCHISSERIES,
        OWNERS,
        PROVIDERS
    }

    public enum ProspectStatus {
        TO_CONTACT,
        IN_DISCUSSION,
        PARTNER,
        REJECTED
    }

    // ─── Fields ─────────────────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank(message = "Le nom est obligatoire")
    @Column(nullable = false)
    private String name;

    private String email;

    private String phone;

    private String city;

    private String specialty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProspectCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProspectStatus status = ProspectStatus.TO_CONTACT;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(length = 500)
    private String website;

    @Column(name = "linked_in", length = 500)
    private String linkedIn;

    @Column(length = 100)
    private String revenue;

    @Column(length = 50)
    private String employees;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name="contact_type", length=40)
    private String contactType = "PROVIDER";

    @Column(name="contact_nature", length=40)
    private String contactNature = "UNKNOWN";

    @Column(name="source_type", length=40)
    private String sourceType = "LEGACY";

    @Column(name="source_detail", length=1000)
    private String sourceDetail;

    @Column(name="source_url", length=2000)
    private String sourceUrl;

    @Column(name="source_recorded_at")
    private java.time.Instant sourceRecordedAt;

    @Column(name="normalized_email", length=255)
    private String normalizedEmail;

    @Column(name="normalized_phone", length=40)
    private String normalizedPhone;

    @Column(name="archived")
    private boolean archived;

    @Column(name="identity_version")
    private int identityVersion;

    // ─── Constructors ───────────────────────────────────────────────────────────

    public Prospect() {}

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getSpecialty() { return specialty; }
    public void setSpecialty(String specialty) { this.specialty = specialty; }

    public ProspectCategory getCategory() { return category; }
    public void setCategory(ProspectCategory category) { this.category = category; }

    public ProspectStatus getStatus() { return status; }
    public void setStatus(ProspectStatus status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }

    public String getLinkedIn() { return linkedIn; }
    public void setLinkedIn(String linkedIn) { this.linkedIn = linkedIn; }

    public String getRevenue() { return revenue; }
    public void setRevenue(String revenue) { this.revenue = revenue; }

    public String getEmployees() { return employees; }
    public void setEmployees(String employees) { this.employees = employees; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getContactType() { return contactType; }
    public void setContactType(String value) { contactType=value; }
    public String getContactNature() { return contactNature; }
    public void setContactNature(String value) { contactNature=value; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String value) { sourceType=value; }
    public String getSourceDetail() { return sourceDetail; }
    public void setSourceDetail(String value) { sourceDetail=value; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String value) { sourceUrl=value; }
    public java.time.Instant getSourceRecordedAt() { return sourceRecordedAt; }
    public void setSourceRecordedAt(java.time.Instant value) { sourceRecordedAt=value; }
    public String getNormalizedEmail() { return normalizedEmail; }
    public void setNormalizedEmail(String value) { normalizedEmail=value; }
    public String getNormalizedPhone() { return normalizedPhone; }
    public void setNormalizedPhone(String value) { normalizedPhone=value; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean value) { archived=value; }
    public int getIdentityVersion() { return identityVersion; }
    public void setIdentityVersion(int value) { identityVersion=value; }
}
