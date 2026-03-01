package com.clenzy.integration.channel.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

/**
 * Requete de connexion a un channel.
 * Les credentials varient selon le channel — stockes dans un map generique.
 *
 * Exemples de credentials par channel :
 * - BOOKING : { "hotelId": "...", "username": "...", "password": "..." }
 * - EXPEDIA : { "propertyId": "...", "apiKey": "...", "apiSecret": "..." }
 * - HOTELS_COM : { "propertyId": "...", "apiKey": "...", "apiSecret": "..." }
 * - AGODA : { "propertyId": "...", "apiKey": "...", "apiSecret": "..." }
 * - HOMEAWAY : { "listingId": "...", "accessToken": "...", "refreshToken": "..." }
 */
public record ChannelConnectRequest(
    @NotEmpty Map<String, String> credentials
) {}
