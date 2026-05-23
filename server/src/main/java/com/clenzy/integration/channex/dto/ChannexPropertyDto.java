package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Representation minimale d'une Property cote Channex.
 *
 * <p>Le payload Channex contient bien plus de champs (address, photos, amenities,
 * tax settings) que ce qui nous interesse — on ne deserialise que les champs
 * critiques pour le mapping. Le reste est ignore via
 * {@link JsonIgnoreProperties}.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexPropertyDto(
    String id,
    String title,
    @JsonProperty("currency") String currency,
    @JsonProperty("group_id") String groupId,
    @JsonProperty("timezone") String timezone
) {}
