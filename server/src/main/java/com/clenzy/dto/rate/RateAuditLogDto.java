package com.clenzy.dto.rate;

import com.clenzy.model.RateAuditLog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Projection DTO du journal d'audit tarifaire.
 *
 * Shape JSON strictement identique a l'entite {@link RateAuditLog}
 * auparavant exposee brute par GET /api/rates/audit-log (audit T-ARCH-07 :
 * jamais d'entite JPA sur un endpoint REST) — memes noms et types de champs.
 */
public record RateAuditLogDto(
        Long id,
        Long organizationId,
        Long propertyId,
        LocalDate date,
        Long ratePlanId,
        String oldValue,
        String newValue,
        BigDecimal previousPrice,
        BigDecimal newPrice,
        String changedBy,
        String source,
        String ruleName,
        String channelName,
        LocalDateTime changedAt
) {
    public static RateAuditLogDto from(RateAuditLog entity) {
        return new RateAuditLogDto(
                entity.getId(),
                entity.getOrganizationId(),
                entity.getPropertyId(),
                entity.getDate(),
                entity.getRatePlanId(),
                entity.getOldValue(),
                entity.getNewValue(),
                entity.getPreviousPrice(),
                entity.getNewPrice(),
                entity.getChangedBy(),
                entity.getSource(),
                entity.getRuleName(),
                entity.getChannelName(),
                entity.getChangedAt()
        );
    }
}
