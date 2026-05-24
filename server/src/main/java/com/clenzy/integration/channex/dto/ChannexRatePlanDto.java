package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexRatePlanDto(
    String id,
    String title,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("room_type_id") String roomTypeId,
    @JsonProperty("currency") String currency,
    @JsonProperty("sell_mode") String sellMode
) {}
