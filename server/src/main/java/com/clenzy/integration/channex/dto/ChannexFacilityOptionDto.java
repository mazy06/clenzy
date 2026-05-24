package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Element du catalogue global Channex des facilities (exposable via
 * {@code GET /property_facilities/options} ou {@code /room_facilities/options}).
 *
 * <p>Channex maintient une taxonomie de ~180 facilities standards
 * (wifi, parking, pool, jacuzzi, breakfast, gym, restaurant, etc.) classees
 * par categorie. On expose ce catalogue cote UI Clenzy pour proposer ces
 * libelles comme suggestions a l'admin qui cree des CustomAmenity (autocomplete).</p>
 *
 * @param id        identifiant Channex (UUID ou code)
 * @param title     libelle humain (anglais : "Wi-Fi", "Free Parking", ...)
 * @param category  groupe : "internet", "parking", "wellness", ...
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexFacilityOptionDto(
    String id,
    String title,
    String category
) {}
