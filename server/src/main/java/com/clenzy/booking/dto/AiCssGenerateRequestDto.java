package com.clenzy.booking.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotNull;

/**
 * Request to regenerate CSS from user-edited design tokens.
 */
public record AiCssGenerateRequestDto(
    @NotNull(message = "Design tokens are required")
    DesignTokensDto designTokens,

    @Nullable
    String additionalInstructions
) {}
