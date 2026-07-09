package com.clenzy.booking.dto;

import com.clenzy.booking.model.DesignSystem;

import java.time.LocalDateTime;

/**
 * Vue d'un système de design. {@code scope} = GLOBAL (catalogue Baitly, org NULL) ou ORG (privé).
 * {@code tokensJson} = map {@code --bt-*} ; {@code designMarkdown} = la direction en prose (DESIGN.md).
 */
public record DesignSystemDto(
    Long id,
    String name,
    String category,
    String description,
    String status,
    String tokensJson,
    String designMarkdown,
    String sourceType,
    String sourceRef,
    String scope,
    Long organizationId,
    LocalDateTime createdAt
) {
    public static DesignSystemDto from(DesignSystem d) {
        return new DesignSystemDto(
            d.getId(),
            d.getName(),
            d.getCategory(),
            d.getDescription(),
            d.getStatus(),
            d.getTokensJson(),
            d.getDesignMarkdown(),
            d.getSourceType(),
            d.getSourceRef(),
            d.getOrganizationId() == null ? "GLOBAL" : "ORG",
            d.getOrganizationId(),
            d.getCreatedAt()
        );
    }
}
