package com.clenzy.dto;

/**
 * Vue publique d'une demande de signature de contrat de gestion (page /sign/{token}).
 * Volontairement minimale : uniquement ce que le signataire doit voir.
 *
 * @param status            PENDING | SIGNED | EXPIRED | CANCELLED
 * @param commissionRate    fraction (ex. 0.20)
 * @param documentAvailable le PDF du mandat est consultable via GET /{token}/document
 */
public record ContractSignaturePublicDto(
    String status,
    String contractNumber,
    String contractType,
    String propertyName,
    String ownerName,
    Double commissionRate,
    String startDate,
    String endDate,
    String paymentModel,
    /**
     * Mandat DÉCLARATIF — AGENCY ou OWNER. Affiché AVANT signature : le
     * propriétaire doit savoir ce qu il délègue, et ce qu il garde. Sans cet
     * affichage, le champ serait un réglage interne, pas une autorisation.
     */
    String policeDeclarationBy,
    String touristTaxBy,
    String licenceHeldBy,
    Boolean documentAvailable,
    String signedAt,
    String signedByName,
    String expiresAt,
    String consentText
) {}
