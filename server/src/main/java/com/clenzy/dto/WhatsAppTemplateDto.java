package com.clenzy.dto;

import com.clenzy.model.WhatsAppTemplate;
import com.clenzy.model.WhatsAppTemplateStatus;
import java.time.LocalDateTime;

public record WhatsAppTemplateDto(
    Long id,
    String templateName,
    String language,
    String category,
    WhatsAppTemplateStatus status,
    String components,
    LocalDateTime syncedAt
) {
    public static WhatsAppTemplateDto from(WhatsAppTemplate t) {
        return new WhatsAppTemplateDto(
            t.getId(), t.getTemplateName(), t.getLanguage(),
            t.getCategory(), t.getStatus(), t.getComponents(), t.getSyncedAt()
        );
    }
}
