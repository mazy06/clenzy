package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corps de création / mise à jour d'un site hébergé (champs settables). */
public record SiteUpsertRequest(
    @NotBlank @Size(max = 63)
    @Pattern(regexp = "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", message = "slug invalide (a-z, 0-9, tirets)")
    String slug,
    @Size(max = 150) String name,
    String status,
    String defaultLocale,
    String locales,
    String designTokens,
    String primaryColor,
    String fontFamily,
    String logoUrl,
    String seoTitle,
    String seoDescription,
    String seoOgImageUrl,
    Long bookingEngineConfigId
) {}
