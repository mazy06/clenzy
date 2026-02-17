package com.clenzy.dto;

import com.clenzy.model.DocumentTemplate;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentTemplateDto(
        Long id,
        String name,
        String description,
        String documentType,
        String eventTrigger,
        String originalFilename,
        Integer version,
        Boolean active,
        String emailSubject,
        String emailBody,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<DocumentTemplateTagDto> tags
) {
    public static DocumentTemplateDto fromEntity(DocumentTemplate entity) {
        List<DocumentTemplateTagDto> tagDtos = entity.getTags() != null
                ? entity.getTags().stream().map(DocumentTemplateTagDto::fromEntity).toList()
                : List.of();
        return new DocumentTemplateDto(
                entity.getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getDocumentType().name(),
                entity.getEventTrigger(),
                entity.getOriginalFilename(),
                entity.getVersion(),
                entity.isActive(),
                entity.getEmailSubject(),
                entity.getEmailBody(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                tagDtos
        );
    }
}
