package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;

/**
 * Payload d'upsert d'une configuration de taxe de séjour.
 *
 * <p>Ne contient QUE les champs réellement modifiables par le client (audit
 * règle n°5 — fermeture du mass assignment) : ni {@code id}, ni
 * {@code organizationId}, ni horodatages système ne sont acceptés. La clé
 * naturelle est {@code propertyId} — {@code null} = barème PAR DÉFAUT de
 * l'organisation (un seul par org), sinon override par bien (un par
 * propriété). L'organisation est imposée par le {@code TenantContext} côté
 * service. {@code percentageRate} est une fraction (0.05 = 5 %).</p>
 */
public record TouristTaxConfigRequest(
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
    Boolean enabled
) {}
