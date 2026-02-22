package com.clenzy.dto;

import com.clenzy.model.MessageTemplate;

public record MessageTemplateDto(
    Long id,
    String name,
    String type,
    String subject,
    String body,
    String language,
    boolean isActive,
    String createdAt,
    String updatedAt
) {
    public static MessageTemplateDto fromEntity(MessageTemplate e) {
        return new MessageTemplateDto(
            e.getId(),
            e.getName(),
            e.getType().getValue(),
            e.getSubject(),
            e.getBody(),
            e.getLanguage(),
            e.isActive(),
            e.getCreatedAt() != null ? e.getCreatedAt().toString() : null,
            e.getUpdatedAt() != null ? e.getUpdatedAt().toString() : null
        );
    }
}
