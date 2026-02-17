package com.clenzy.dto;

import com.clenzy.model.DocumentTemplateTag;

public record DocumentTemplateTagDto(
        Long id,
        String tagName,
        String tagCategory,
        String dataSource,
        String description,
        String tagType,
        Boolean required
) {
    public static DocumentTemplateTagDto fromEntity(DocumentTemplateTag tag) {
        return new DocumentTemplateTagDto(
                tag.getId(),
                tag.getTagName(),
                tag.getTagCategory().name(),
                tag.getDataSource(),
                tag.getDescription(),
                tag.getTagType().name(),
                tag.getRequired()
        );
    }
}
