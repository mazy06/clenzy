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
    String curatedActivities,
    Boolean upsellsEnabled,
    String upsellOfferIds,
    @jakarta.validation.constraints.Pattern(regexp = "essentiel|complet|cityguide|longue|conciergerie") String structure
) {
    /** Compatibilité des appelants Java existants ; le champ JSON reste facultatif. */
    public WelcomeGuideRequest(Long propertyId, String title, String language, String sections,
            String brandingColor, String theme, String heroPhotoIds, String welcomeMessage,
            String hostNames, String logoUrl, Boolean published, Boolean chatbotEnabled,
            Boolean guestbookEnabled, Boolean activitiesEnabled, String pois, String curatedActivities,
            Boolean upsellsEnabled, String upsellOfferIds) {
        this(propertyId, title, language, sections, brandingColor, theme, heroPhotoIds, welcomeMessage,
            hostNames, logoUrl, published, chatbotEnabled, guestbookEnabled, activitiesEnabled,
            pois, curatedActivities, upsellsEnabled, upsellOfferIds, null);
    }
}
