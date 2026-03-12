package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request to analyze a website and extract design tokens.
 */
public record AiDesignAnalysisRequestDto(
    @NotBlank(message = "Website URL is required")
    String websiteUrl
) {}
