package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelContentMapping;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChannelContentMappingDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        List<String> amenities = List.of("wifi", "pool");
        List<String> photos = List.of("p1.jpg", "p2.jpg");
        Map<String, Object> config = new HashMap<>();
        config.put("locale", "fr");
        Instant syncedAt = Instant.parse("2026-05-15T10:00:00Z");
        Instant createdAt = Instant.parse("2026-04-30T09:00:00Z");

        ChannelContentMappingDto dto = new ChannelContentMappingDto(
                1L, 10L,
                ChannelName.AIRBNB,
                "Beachside villa",
                "Sunny villa near the sea",
                amenities,
                photos,
                "VILLA",
                3, 2, 6,
                config,
                "SYNCED",
                syncedAt,
                createdAt
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.propertyId());
        assertEquals(ChannelName.AIRBNB, dto.channelName());
        assertEquals("Beachside villa", dto.title());
        assertEquals("Sunny villa near the sea", dto.description());
        assertEquals(amenities, dto.amenities());
        assertEquals(photos, dto.photoUrls());
        assertEquals("VILLA", dto.propertyType());
        assertEquals(3, dto.bedrooms());
        assertEquals(2, dto.bathrooms());
        assertEquals(6, dto.maxGuests());
        assertEquals(config, dto.config());
        assertEquals("SYNCED", dto.syncStatus());
        assertEquals(syncedAt, dto.syncedAt());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_mapsAllEntityFields() {
        List<String> amenities = List.of("wifi", "kitchen");
        List<String> photos = List.of("a.jpg");
        Map<String, Object> config = new HashMap<>();
        config.put("style", "modern");
        Instant syncedAt = Instant.parse("2026-05-20T11:00:00Z");

        ChannelContentMapping entity = new ChannelContentMapping();
        entity.setId(42L);
        entity.setPropertyId(7L);
        entity.setChannelName(ChannelName.BOOKING);
        entity.setTitle("Studio Paris");
        entity.setDescription("Cosy studio");
        entity.setAmenities(amenities);
        entity.setPhotoUrls(photos);
        entity.setPropertyType("APARTMENT");
        entity.setBedrooms(1);
        entity.setBathrooms(1);
        entity.setMaxGuests(2);
        entity.setConfig(config);
        entity.setSyncStatus("ERROR");
        entity.setSyncedAt(syncedAt);

        ChannelContentMappingDto dto = ChannelContentMappingDto.from(entity);

        assertEquals(42L, dto.id());
        assertEquals(7L, dto.propertyId());
        assertEquals(ChannelName.BOOKING, dto.channelName());
        assertEquals("Studio Paris", dto.title());
        assertEquals("Cosy studio", dto.description());
        assertEquals(amenities, dto.amenities());
        assertEquals(photos, dto.photoUrls());
        assertEquals("APARTMENT", dto.propertyType());
        assertEquals(1, dto.bedrooms());
        assertEquals(1, dto.bathrooms());
        assertEquals(2, dto.maxGuests());
        assertEquals(config, dto.config());
        assertEquals("ERROR", dto.syncStatus());
        assertEquals(syncedAt, dto.syncedAt());
        assertNull(dto.createdAt());
    }

    @Test
    void from_emptyEntity_returnsDefaults() {
        ChannelContentMapping entity = new ChannelContentMapping();

        ChannelContentMappingDto dto = ChannelContentMappingDto.from(entity);

        assertNull(dto.id());
        assertNotNull(dto.amenities());
        assertTrue(dto.amenities().isEmpty());
        assertNotNull(dto.photoUrls());
        assertTrue(dto.photoUrls().isEmpty());
        assertEquals("PENDING", dto.syncStatus()); // default in entity
    }
}
