package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO de sortie de {@link TouristTaxConfig}.
 *
 * <p>Mapping explicite champ à champ (audit règle n°5 — pas d'entité JPA
 * exposée par un endpoint REST). {@code propertyId} null = barème par défaut
 * de l'org. {@code percentageRate} est une fraction (0.05 = 5 %).</p>
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
    BigDecimal capPerPersonNight,
    BigDecimal departmentalSurchargePct,
    BigDecimal regionalSurchargePct,
    Boolean exemptMinors,
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
            c.getCapPerPersonNight(),
            c.getDepartmentalSurchargePct(),
            c.getRegionalSurchargePct(),
            c.getExemptMinors(),
            c.getMaxNights(),
            c.getChildrenExemptUnder(),
            c.getEnabled(),
            c.getCreatedAt(),
            c.getUpdatedAt()
        );
    }
}
