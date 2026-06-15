package com.clenzy.booking.dto;

import java.time.LocalDateTime;

/**
 * Entrée de sitemap agrégée (P1.2) : URL relative + type + dernière modif + locale. Le service SSR
 * compose le XML final (loc absolue, alternates hreflang) à partir de cette liste.
 */
public record SitemapEntryDto(
    String path,
    String type,
    String locale,
    LocalDateTime lastmod
) {}
