package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Site hébergé « Clenzy Sites » (P1.1) — couche site public rendu côté serveur (Next.js SSR),
 * distincte du {@link BookingEngineConfig} (widget embarquable) qu'elle peut référencer pour le
 * module de réservation. Un site appartient à une org, expose un slug (`{slug}.clenzy.site`),
 * porte le thème + les défauts SEO, et agrège des {@link SitePage} et {@link SiteDomain}.
 */
@Entity
@Table(name = "sites", indexes = {
    @Index(name = "idx_sites_org_id", columnList = "organization_id"),
    @Index(name = "idx_sites_slug", columnList = "slug", unique = true)
})
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Lien optionnel vers la config du widget (module de réservation embarqué dans les pages). */
    @Column(name = "booking_engine_config_id")
    private Long bookingEngineConfigId;

    @Column(name = "slug", nullable = false, unique = true, length = 63)
    private String slug;

    @Column(name = "name", nullable = false, length = 150)
    private String name = "Mon site";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SiteStatus status = SiteStatus.DRAFT;

    @Column(name = "default_locale", nullable = false, length = 5)
    private String defaultLocale = "fr";

    /** Locales activées (CSV, ex. "fr,en,ar"). */
    @Column(name = "locales", nullable = false, length = 64)
    private String locales = "fr";

    @Column(name = "design_tokens", columnDefinition = "TEXT")
    private String designTokens;

    @Column(name = "primary_color", length = 7)
    private String primaryColor;

    @Column(name = "font_family", length = 100)
    private String fontFamily;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "seo_title", length = 255)
    private String seoTitle;

    @Column(name = "seo_description", columnDefinition = "TEXT")
    private String seoDescription;

    @Column(name = "seo_og_image_url", length = 500)
    private String seoOgImageUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getBookingEngineConfigId() { return bookingEngineConfigId; }
    public void setBookingEngineConfigId(Long bookingEngineConfigId) { this.bookingEngineConfigId = bookingEngineConfigId; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public SiteStatus getStatus() { return status; }
    public void setStatus(SiteStatus status) { this.status = status; }

    public String getDefaultLocale() { return defaultLocale; }
    public void setDefaultLocale(String defaultLocale) { this.defaultLocale = defaultLocale; }

    public String getLocales() { return locales; }
    public void setLocales(String locales) { this.locales = locales; }

    public String getDesignTokens() { return designTokens; }
    public void setDesignTokens(String designTokens) { this.designTokens = designTokens; }

    public String getPrimaryColor() { return primaryColor; }
    public void setPrimaryColor(String primaryColor) { this.primaryColor = primaryColor; }

    public String getFontFamily() { return fontFamily; }
    public void setFontFamily(String fontFamily) { this.fontFamily = fontFamily; }

    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }

    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }

    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }

    public String getSeoOgImageUrl() { return seoOgImageUrl; }
    public void setSeoOgImageUrl(String seoOgImageUrl) { this.seoOgImageUrl = seoOgImageUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public int getVersion() { return version; }
}
