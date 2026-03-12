package com.clenzy.booking.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Design tokens extracted from a website by AI or set manually.
 * All fields are nullable — null means "not detected" or "not set".
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DesignTokensDto(
    // Colors
    String primaryColor,
    String secondaryColor,
    String accentColor,
    String backgroundColor,
    String surfaceColor,
    String textColor,
    String textSecondaryColor,
    // Typography
    String headingFontFamily,
    String bodyFontFamily,
    String baseFontSize,
    String headingFontWeight,
    // Spacing & Borders
    String borderRadius,
    String buttonBorderRadius,
    String cardBorderRadius,
    String spacing,
    // Shadows
    String boxShadow,
    String cardShadow,
    // Buttons
    String buttonStyle,         // "filled", "outlined", "rounded"
    String buttonTextTransform, // "uppercase", "none", "capitalize"
    // Misc
    String borderColor,
    String dividerColor
) {}
