package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WelcomeGuideRequest(
    @NotNull Long propertyId,
    @NotBlank String title,
    String language,
    String sections,
    String brandingColor,
    String logoUrl,
    Boolean published
) {}
