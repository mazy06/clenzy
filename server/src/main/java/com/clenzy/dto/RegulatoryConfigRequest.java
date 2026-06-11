package com.clenzy.dto;

import com.clenzy.model.RegulatoryConfig.RegulatoryType;

/**
 * Payload d'upsert d'une configuration reglementaire.
 *
 * <p>Ne contient QUE les champs reellement modifiables par le client (audit
 * regle n°5 — fermeture du mass assignment) : ni {@code id}, ni
 * {@code organizationId}, ni horodatages systeme ne sont acceptes. La cle
 * naturelle est {@code (propertyId, regulatoryType)} (une config par type
 * reglementaire et par propriete) ; l'organisation est imposee par le
 * {@code TenantContext} cote service.</p>
 */
public record RegulatoryConfigRequest(
    Long propertyId,
    RegulatoryType regulatoryType,
    Boolean isEnabled,
    String registrationNumber,
    Integer maxDaysPerYear,
    String countryCode,
    String cityCode,
    String notes
) {}
