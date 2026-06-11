package com.clenzy.dto;

import com.clenzy.model.SplitConfiguration;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO API de {@link SplitConfiguration}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, organizationId, name, ownerShare, platformShare, conciergeShare,
 * isDefault, active, createdAt, updatedAt.</p>
 */
public record SplitConfigurationDto(
    Long id,
    Long organizationId,
    String name,
    BigDecimal ownerShare,
    BigDecimal platformShare,
    BigDecimal conciergeShare,
    Boolean isDefault,
    Boolean active,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static SplitConfigurationDto from(SplitConfiguration s) {
        return new SplitConfigurationDto(
            s.getId(),
            s.getOrganizationId(),
            s.getName(),
            s.getOwnerShare(),
            s.getPlatformShare(),
            s.getConciergeShare(),
            s.getIsDefault(),
            s.getActive(),
            s.getCreatedAt(),
            s.getUpdatedAt()
        );
    }
}
