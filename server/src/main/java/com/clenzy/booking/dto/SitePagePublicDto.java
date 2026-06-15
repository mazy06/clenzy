package com.clenzy.booking.dto;

import com.clenzy.booking.model.SitePage;

/** Contenu public d'une page (blocs + SEO) — rendu serveur par le service SSR. */
public record SitePagePublicDto(
    String path,
    String type,
    String title,
    String blocks,
    String locale,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl
) {
    public static SitePagePublicDto from(SitePage p) {
        // Draft / Live (2.7) : on sert l'instantané publié (repli sur le brouillon si jamais publié).
        String published = p.getPublishedBlocks() != null ? p.getPublishedBlocks() : p.getBlocks();
        return new SitePagePublicDto(
            p.getPath(),
            p.getType() != null ? p.getType().name() : null,
            p.getTitle(), published, p.getLocale(),
            p.getSeoTitle(), p.getSeoDescription(), p.getSeoOgImageUrl());
    }
}
