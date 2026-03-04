package com.clenzy.integration.hubspot.dto;

import java.util.Map;

/**
 * DTO pour un deal HubSpot.
 *
 * @param dealName   nom du deal
 * @param amount     montant du deal
 * @param stage      etape dans le pipeline
 * @param pipeline   identifiant du pipeline
 * @param closeDate  date de cloture prevue (format ISO yyyy-MM-dd)
 * @param contactId  identifiant du contact associe
 * @param properties proprietes supplementaires libres
 */
public record HubSpotDealDto(
    String dealName,
    String amount,
    String stage,
    String pipeline,
    String closeDate,
    String contactId,
    Map<String, String> properties
) {}
