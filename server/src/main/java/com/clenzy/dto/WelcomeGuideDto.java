package com.clenzy.dto;

import com.clenzy.model.WelcomeGuide;
import java.time.LocalDateTime;

public record WelcomeGuideDto(
    Long id,
    Long propertyId,
    String propertyName,
    String language,
    String title,
    String sections,
    String pois,
    String curatedActivities,
    String brandingColor,
    String theme,
    String heroPhotoIds,
    String welcomeMessage,
    String hostNames,
    String logoUrl,
    boolean published,
    boolean chatbotEnabled,
    boolean guestbookEnabled,
    boolean activitiesEnabled,
    LocalDateTime createdAt
) {
    public static WelcomeGuideDto from(WelcomeGuide g) {
        return new WelcomeGuideDto(
            g.getId(),
            g.getProperty() != null ? g.getProperty().getId() : null,
            g.getProperty() != null ? g.getProperty().getName() : null,
            g.getLanguage(), g.getTitle(), g.getSections(), g.getPois(), g.getCuratedActivities(),
            g.getBrandingColor(), g.getTheme(), g.getHeroPhotoIds(),
            g.getWelcomeMessage(), g.getHostNames(), g.getLogoUrl(), g.isPublished(),
            g.isChatbotEnabled(), g.isGuestbookEnabled(), g.isActivitiesEnabled(), g.getCreatedAt()
        );
    }
}
