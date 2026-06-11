package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO de sortie de {@link TouristTaxConfig}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, organizationId, propertyId, communeName, communeCode, calculationMode,
 * ratePerPerson, percentageRate, maxNights, childrenExemptUnder, enabled,
 * createdAt, updatedAt.</p>
 */
public record TouristTaxConfigDto(
    Long id,
    Long organizationId,
    Long propertyId,
    String communeName,
    String communeCode,
    TaxCalculationMode calculationMode,
    BigDecimal ratePerPerson,
    BigDecimal percentageRate,
    Integer maxNights,
    Integer childrenExemptUnder,
    Boolean enabled,
    Instant createdAt,
    Instant updatedAt
) {
    public static TouristTaxConfigDto from(TouristTaxConfig c) {
        return new TouristTaxConfigDto(
            c.getId(),
            c.getOrganizationId(),
            c.getPropertyId(),
            c.getCommuneName(),
            c.getCommuneCode(),
            c.getCalculationMode(),
            c.getRatePerPerson(),
            c.getPercentageRate(),
            c.getMaxNights(),
            c.getChildrenExemptUnder(),
            c.getEnabled(),
            c.getCreatedAt(),
            c.getUpdatedAt()
        );
    }
}
