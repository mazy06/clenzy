package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;

/**
 * Payload d'upsert d'une configuration de taxe de sejour.
 *
 * <p>Ne contient QUE les champs reellement modifiables par le client (audit
 * regle n°5 — fermeture du mass assignment) : ni {@code id}, ni
 * {@code organizationId}, ni horodatages systeme ne sont acceptes. La cle
 * naturelle est {@code propertyId} (une config par propriete et par org) ;
 * l'organisation est imposee par le {@code TenantContext} cote service.</p>
 */
public record TouristTaxConfigRequest(
    Long propertyId,
    String communeName,
    String communeCode,
    TaxCalculationMode calculationMode,
    BigDecimal ratePerPerson,
    BigDecimal percentageRate,
    Integer maxNights,
    Integer childrenExemptUnder,
    Boolean enabled
) {}
