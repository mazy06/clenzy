package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexRoomTypeDto(
    String id,
    String title,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("count_of_rooms") Integer countOfRooms
) {}
