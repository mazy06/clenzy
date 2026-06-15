package com.clenzy.booking.dto;

import com.clenzy.booking.model.BlogPost;

import java.time.LocalDateTime;

/** Contenu public d'un article (corps complet + SEO) — rendu SSR + schema Article. */
public record BlogPostPublicDto(
    String slug,
    String locale,
    String title,
    String excerpt,
    String body,
    String coverImageUrl,
    String tags,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl,
    LocalDateTime publishedAt
) {
    public static BlogPostPublicDto from(BlogPost p) {
        return new BlogPostPublicDto(
            p.getSlug(), p.getLocale(), p.getTitle(), p.getExcerpt(), p.getBody(),
            p.getCoverImageUrl(), p.getTags(), p.getSeoTitle(), p.getSeoDescription(),
            p.getSeoOgImageUrl(), p.getPublishedAt());
    }
}
