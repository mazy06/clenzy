package com.clenzy.booking.dto;

import com.clenzy.booking.model.SitePage;

/** Vue admin d'une page de site (sert aussi de corps create/update : {@code id}/{@code siteId} ignorés). */
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
    String seoOgImageUrl
) {
    public static SitePageDto from(SitePage p) {
        return new SitePageDto(
            p.getId(), p.getSiteId(), p.getPath(),
            p.getType() != null ? p.getType().name() : null,
            p.getTitle(), p.getBlocks(), p.getLocale(),
            p.getStatus() != null ? p.getStatus().name() : null,
            p.getSortOrder(), p.getSeoTitle(), p.getSeoDescription(), p.getSeoOgImageUrl());
    }
}
