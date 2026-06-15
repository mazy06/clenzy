package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Article de blog d'un site hébergé (P1.3) — rendu SSR (+ RSS + schema Article) par le service
 * « Clenzy Sites ». Réutilise {@link SiteStatus} (DRAFT/PUBLISHED). Corps en markdown/MDX.
 */
@Entity
@Table(name = "blog_posts",
    indexes = {
        @Index(name = "idx_blog_posts_site_id", columnList = "site_id"),
        @Index(name = "idx_blog_posts_org_id", columnList = "organization_id")
    },
    uniqueConstraints = { @UniqueConstraint(name = "uq_blog_post_slug", columnNames = {"site_id", "slug", "locale"}) })
public class BlogPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id", nullable = false)
    private Long siteId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "slug", nullable = false, length = 255)
    private String slug;

    @Column(name = "locale", length = 5)
    private String locale;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "excerpt", columnDefinition = "TEXT")
    private String excerpt;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    /** Tags (CSV). */
    @Column(name = "tags", length = 512)
    private String tags;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SiteStatus status = SiteStatus.DRAFT;

    @Column(name = "seo_title", length = 255)
    private String seoTitle;

    @Column(name = "seo_description", columnDefinition = "TEXT")
    private String seoDescription;

    @Column(name = "seo_og_image_url", length = 500)
    private String seoOgImageUrl;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    /** Contenu issu d'une génération IA (2.13) → relecture manuelle d'autant plus requise. */
    @Column(name = "ai_generated", nullable = false)
    private boolean aiGenerated = false;

    /** Validation manuelle (2.13) : horodatage + keycloakId du relecteur ayant approuvé la publication. */
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by", length = 255)
    private String reviewedBy;

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

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String excerpt) { this.excerpt = excerpt; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public SiteStatus getStatus() { return status; }
    public void setStatus(SiteStatus status) { this.status = status; }

    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }

    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }

    public String getSeoOgImageUrl() { return seoOgImageUrl; }
    public void setSeoOgImageUrl(String seoOgImageUrl) { this.seoOgImageUrl = seoOgImageUrl; }

    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }

    public boolean isAiGenerated() { return aiGenerated; }
    public void setAiGenerated(boolean aiGenerated) { this.aiGenerated = aiGenerated; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
