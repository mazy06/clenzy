package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WelcomeGuideRequest(
    @NotNull Long propertyId,
    @NotBlank String title,
    String language,
    String sections,
    String brandingColor,
    String theme,
    String heroPhotoIds,
    String welcomeMessage,
    String hostNames,
    String logoUrl,
    Boolean published,
    Boolean chatbotEnabled,
    Boolean guestbookEnabled,
    Boolean activitiesEnabled,
    String pois,
    String curatedActivities
) {}
