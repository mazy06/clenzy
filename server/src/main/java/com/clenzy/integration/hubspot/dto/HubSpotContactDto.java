package com.clenzy.integration.hubspot.dto;

import java.util.Map;

/**
 * DTO pour un contact HubSpot.
 *
 * @param email      adresse email du contact
 * @param firstName  prenom
 * @param lastName   nom de famille
 * @param phone      numero de telephone
 * @param company    nom de l'entreprise
 * @param properties proprietes supplementaires libres
 */
public record HubSpotContactDto(
    String email,
    String firstName,
    String lastName,
    String phone,
    String company,
    Map<String, String> properties
) {}
