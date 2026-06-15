package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Page d'un site hébergé (P1.1) : chemin + type (home / liste / détail / blog / libre) + composition
 * par blocs (JSON, même format que le builder du Studio) + métadonnées SEO par page. Rendue par le
 * service SSR. Remplace le {@code pageLayout} unique de {@link BookingEngineConfig} (multi-page).
 */
@Entity
@Table(name = "site_pages",
    indexes = { @Index(name = "idx_site_pages_site_id", columnList = "site_id") },
    uniqueConstraints = { @UniqueConstraint(name = "uq_site_page_path", columnNames = {"site_id", "path", "locale"}) })
public class SitePage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id", nullable = false)
    private Long siteId;

    @Column(name = "path", nullable = false, length = 255)
    private String path;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private SitePageType type = SitePageType.CUSTOM;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "blocks", columnDefinition = "TEXT")
    private String blocks;

    /** Instantané publié des blocs (2.7) : servi au public. {@code blocks} est le brouillon de travail. */
    @Column(name = "published_blocks", columnDefinition = "TEXT")
    private String publishedBlocks;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    /** Locale de la page ; NULL = page commune à toutes les locales du site. */
    @Column(name = "locale", length = 5)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SiteStatus status = SiteStatus.DRAFT;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public SitePageType getType() { return type; }
    public void setType(SitePageType type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBlocks() { return blocks; }
    public void setBlocks(String blocks) { this.blocks = blocks; }

    public String getPublishedBlocks() { return publishedBlocks; }
    public void setPublishedBlocks(String publishedBlocks) { this.publishedBlocks = publishedBlocks; }

    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public SiteStatus getStatus() { return status; }
    public void setStatus(SiteStatus status) { this.status = status; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }

    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }

    public String getSeoOgImageUrl() { return seoOgImageUrl; }
    public void setSeoOgImageUrl(String seoOgImageUrl) { this.seoOgImageUrl = seoOgImageUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
