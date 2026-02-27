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
    String brandingColor,
    String logoUrl,
    boolean published,
    LocalDateTime createdAt
) {
    public static WelcomeGuideDto from(WelcomeGuide g) {
        return new WelcomeGuideDto(
            g.getId(),
            g.getProperty() != null ? g.getProperty().getId() : null,
            g.getProperty() != null ? g.getProperty().getName() : null,
            g.getLanguage(), g.getTitle(), g.getSections(),
            g.getBrandingColor(), g.getLogoUrl(), g.isPublished(), g.getCreatedAt()
        );
    }
}
