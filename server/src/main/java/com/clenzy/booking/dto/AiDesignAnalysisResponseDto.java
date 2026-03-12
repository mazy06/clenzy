package com.clenzy.booking.dto;

/**
 * Response from AI website design analysis.
 */
public record AiDesignAnalysisResponseDto(
    DesignTokensDto designTokens,
    String generatedCss,
    String sourceUrl,
    boolean fromCache
) {}
