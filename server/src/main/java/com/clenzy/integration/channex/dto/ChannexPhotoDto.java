package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Photo Channex telle qu'exposee par {@code GET /photos} (endpoint plat) ou
 * par {@code attributes.content.photos[]} dans la response /properties.
 *
 * @param url          URL absolue de la photo
 * @param position     ordre d'affichage (1-based)
 * @param description  legende optionnelle
 * @param kind         "main" | "interior" | "exterior" | ...
 * @param propertyId   property a laquelle la photo est attachee
 * @param roomTypeId   room_type optionnel (photo specifique d'une chambre)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexPhotoDto(
    String id,
    String url,
    Integer position,
    String description,
    String kind,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("room_type_id") String roomTypeId
) {}
