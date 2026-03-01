package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record CreateChannelContentMappingRequest(
    @NotNull Long propertyId,
    @NotNull ChannelName channelName,
    String title,
    String description,
    List<String> amenities,
    List<String> photoUrls,
    String propertyType,
    Integer bedrooms,
    Integer bathrooms,
    Integer maxGuests,
    Map<String, Object> config
) {}
