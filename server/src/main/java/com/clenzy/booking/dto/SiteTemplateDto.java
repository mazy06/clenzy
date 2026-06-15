package com.clenzy.booking.dto;

import com.clenzy.booking.model.SiteTemplate;

import java.time.LocalDateTime;

/**
 * Vue d'un template de site (galerie « Choisir un design »). {@code scope} = GLOBAL (catalogue
 * Clenzy, org NULL) ou ORG (privé). {@code contentJson} = le template.json à appliquer à l'import.
 */
public record SiteTemplateDto(
    Long id,
    String name,
    String description,
    String register,
    String previewUrl,
    String contentJson,
    String scope,
    Long organizationId,
    LocalDateTime createdAt
) {
    public static SiteTemplateDto from(SiteTemplate t) {
        return new SiteTemplateDto(
            t.getId(),
            t.getName(),
            t.getDescription(),
            t.getRegister(),
            t.getPreviewUrl(),
            t.getContentJson(),
            t.getOrganizationId() == null ? "GLOBAL" : "ORG",
            t.getOrganizationId(),
            t.getCreatedAt()
        );
    }
}
