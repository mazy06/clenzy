package com.clenzy.booking.dto;

import com.clenzy.booking.model.SitePage;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Vue admin d'une page de site (sert aussi de corps create/update : {@code id}/{@code siteId} ignorés).
 * {@code publishedAt}/{@code dirty} (2.7) sont en lecture seule (ignorés en entrée) : {@code dirty} =
 * le brouillon {@code blocks} diffère de l'instantané publié.
 */
public record SitePageDto(
    Long id,
    Long siteId,
    String path,
    String type,
    String title,
    String blocks,
    String locale,
    String status,
    int sortOrder,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl,
    LocalDateTime publishedAt,
    boolean dirty
) {
    public static SitePageDto from(SitePage p) {
        return new SitePageDto(
            p.getId(), p.getSiteId(), p.getPath(),
            p.getType() != null ? p.getType().name() : null,
            p.getTitle(), p.getBlocks(), p.getLocale(),
            p.getStatus() != null ? p.getStatus().name() : null,
            p.getSortOrder(), p.getSeoTitle(), p.getSeoDescription(), p.getSeoOgImageUrl(),
            p.getPublishedAt(), !Objects.equals(p.getBlocks(), p.getPublishedBlocks()));
    }
}
