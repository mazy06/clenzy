package com.clenzy.booking.dto;

import com.clenzy.booking.model.Site;

/** Vue admin d'un site hébergé. */
public record SiteDto(
    Long id,
    Long bookingEngineConfigId,
    String slug,
    String name,
    String status,
    String defaultLocale,
    String locales,
    String designTokens,
    String primaryColor,
    String fontFamily,
    String logoUrl,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl
) {
    public static SiteDto from(Site s) {
        return new SiteDto(
            s.getId(), s.getBookingEngineConfigId(), s.getSlug(), s.getName(),
            s.getStatus() != null ? s.getStatus().name() : null,
            s.getDefaultLocale(), s.getLocales(), s.getDesignTokens(),
            s.getPrimaryColor(), s.getFontFamily(), s.getLogoUrl(),
            s.getSeoTitle(), s.getSeoDescription(), s.getSeoOgImageUrl());
    }
}
