package com.clenzy.booking.dto;

import com.clenzy.booking.model.BlogPost;

import java.time.LocalDateTime;

/** Vue admin d'un article (sert aussi de corps create/update : {@code id}/{@code siteId} ignorés). */
public record BlogPostDto(
    Long id,
    Long siteId,
    String slug,
    String locale,
    String title,
    String excerpt,
    String body,
    String coverImageUrl,
    String tags,
    String status,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl,
    LocalDateTime publishedAt,
    boolean aiGenerated,
    LocalDateTime reviewedAt,
    String reviewedBy
) {
    public static BlogPostDto from(BlogPost p) {
        return new BlogPostDto(
            p.getId(), p.getSiteId(), p.getSlug(), p.getLocale(), p.getTitle(),
            p.getExcerpt(), p.getBody(), p.getCoverImageUrl(), p.getTags(),
            p.getStatus() != null ? p.getStatus().name() : null,
            p.getSeoTitle(), p.getSeoDescription(), p.getSeoOgImageUrl(), p.getPublishedAt(),
            p.isAiGenerated(), p.getReviewedAt(), p.getReviewedBy());
    }
}
