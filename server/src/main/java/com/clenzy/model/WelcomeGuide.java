package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "welcome_guides")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class WelcomeGuide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(nullable = false, length = 5)
    private String language = "fr";

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "JSONB", nullable = false)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String sections = "[]";

    @Column(name = "branding_color", length = 7)
    private String brandingColor = "#2563EB";

    @Column(name = "logo_url", length = 1000)
    private String logoUrl;

    @Column(nullable = false)
    private boolean published = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSections() { return sections; }
    public void setSections(String sections) { this.sections = sections; }
    public String getBrandingColor() { return brandingColor; }
    public void setBrandingColor(String brandingColor) { this.brandingColor = brandingColor; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
