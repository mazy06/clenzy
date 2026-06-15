package com.clenzy.booking.dto;

import com.clenzy.booking.model.BlogPost;

import java.time.LocalDateTime;

/** Vue liste d'un article (sans le corps) — index blog + RSS. */
public record BlogPostSummaryDto(
    String slug,
    String locale,
    String title,
    String excerpt,
    String coverImageUrl,
    String tags,
    LocalDateTime publishedAt
) {
    public static BlogPostSummaryDto from(BlogPost p) {
        return new BlogPostSummaryDto(
            p.getSlug(), p.getLocale(), p.getTitle(), p.getExcerpt(),
            p.getCoverImageUrl(), p.getTags(), p.getPublishedAt());
    }
}
