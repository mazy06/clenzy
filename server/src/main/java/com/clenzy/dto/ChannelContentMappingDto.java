package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelContentMapping;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ChannelContentMappingDto(
    Long id,
    Long propertyId,
    ChannelName channelName,
    String title,
    String description,
    List<String> amenities,
    List<String> photoUrls,
    String propertyType,
    Integer bedrooms,
    Integer bathrooms,
    Integer maxGuests,
    Map<String, Object> config,
    String syncStatus,
    Instant syncedAt,
    Instant createdAt
) {
    public static ChannelContentMappingDto from(ChannelContentMapping c) {
        return new ChannelContentMappingDto(
            c.getId(), c.getPropertyId(), c.getChannelName(),
            c.getTitle(), c.getDescription(), c.getAmenities(), c.getPhotoUrls(),
            c.getPropertyType(), c.getBedrooms(), c.getBathrooms(), c.getMaxGuests(),
            c.getConfig(), c.getSyncStatus(), c.getSyncedAt(), c.getCreatedAt()
        );
    }
}
