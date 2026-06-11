package com.clenzy.dto;

import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;

import java.time.Instant;

/**
 * DTO de sortie de {@link RegulatoryConfig}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, organizationId, propertyId, regulatoryType, isEnabled, registrationNumber,
 * maxDaysPerYear, countryCode, cityCode, notes, createdAt, updatedAt.</p>
 */
public record RegulatoryConfigDto(
    Long id,
    Long organizationId,
    Long propertyId,
    RegulatoryType regulatoryType,
    Boolean isEnabled,
    String registrationNumber,
    Integer maxDaysPerYear,
    String countryCode,
    String cityCode,
    String notes,
    Instant createdAt,
    Instant updatedAt
) {
    public static RegulatoryConfigDto from(RegulatoryConfig c) {
        return new RegulatoryConfigDto(
            c.getId(),
            c.getOrganizationId(),
            c.getPropertyId(),
            c.getRegulatoryType(),
            c.getIsEnabled(),
            c.getRegistrationNumber(),
            c.getMaxDaysPerYear(),
            c.getCountryCode(),
            c.getCityCode(),
            c.getNotes(),
            c.getCreatedAt(),
            c.getUpdatedAt()
        );
    }
}
