package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.model.PromotionType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChannelPromotionDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        Map<String, Object> config = Map.of("minStay", 3);
        LocalDate start = LocalDate.of(2026, 6, 1);
        LocalDate end = LocalDate.of(2026, 6, 30);
        Instant synced = Instant.parse("2026-05-01T09:00:00Z");
        Instant created = Instant.parse("2026-04-01T09:00:00Z");

        ChannelPromotionDto dto = new ChannelPromotionDto(
            1L, 42L, ChannelName.BOOKING, PromotionType.FLASH_SALE,
            true, config, new BigDecimal("15.00"),
            start, end, PromotionStatus.ACTIVE,
            "ext-promo-99", synced, created
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.propertyId());
        assertEquals(ChannelName.BOOKING, dto.channelName());
        assertEquals(PromotionType.FLASH_SALE, dto.promotionType());
        assertTrue(dto.enabled());
        assertEquals(config, dto.config());
        assertEquals(new BigDecimal("15.00"), dto.discountPercentage());
        assertEquals(start, dto.startDate());
        assertEquals(end, dto.endDate());
        assertEquals(PromotionStatus.ACTIVE, dto.status());
        assertEquals("ext-promo-99", dto.externalPromotionId());
        assertEquals(synced, dto.syncedAt());
        assertEquals(created, dto.createdAt());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        Map<String, Object> config = new HashMap<>();
        config.put("foo", "bar");

        ChannelPromotion p = new ChannelPromotion();
        p.setId(100L);
        p.setPropertyId(7L);
        p.setChannelName(ChannelName.AIRBNB);
        p.setPromotionType(PromotionType.EARLY_BIRD_OTA);
        p.setEnabled(false);
        p.setConfig(config);
        p.setDiscountPercentage(new BigDecimal("10.50"));
        p.setStartDate(LocalDate.of(2026, 7, 1));
        p.setEndDate(LocalDate.of(2026, 7, 31));
        p.setStatus(PromotionStatus.PENDING);
        p.setExternalPromotionId("airbnb-123");
        p.setSyncedAt(Instant.parse("2026-06-01T12:00:00Z"));

        ChannelPromotionDto dto = ChannelPromotionDto.from(p);

        assertEquals(100L, dto.id());
        assertEquals(7L, dto.propertyId());
        assertEquals(ChannelName.AIRBNB, dto.channelName());
        assertEquals(PromotionType.EARLY_BIRD_OTA, dto.promotionType());
        assertFalse(dto.enabled());
        assertEquals(config, dto.config());
        assertEquals(new BigDecimal("10.50"), dto.discountPercentage());
        assertEquals(LocalDate.of(2026, 7, 1), dto.startDate());
        assertEquals(LocalDate.of(2026, 7, 31), dto.endDate());
        assertEquals(PromotionStatus.PENDING, dto.status());
        assertEquals("airbnb-123", dto.externalPromotionId());
        assertEquals(Instant.parse("2026-06-01T12:00:00Z"), dto.syncedAt());
        // createdAt set via @PrePersist — null sans persistance
        assertNull(dto.createdAt());
    }

    @Test
    void from_minimalEntity_returnsEntityDefaults() {
        ChannelPromotion p = new ChannelPromotion();
        p.setPropertyId(1L);
        p.setChannelName(ChannelName.VRBO);
        p.setPromotionType(PromotionType.MOBILE_RATE);

        ChannelPromotionDto dto = ChannelPromotionDto.from(p);

        assertNull(dto.id());
        assertEquals(ChannelName.VRBO, dto.channelName());
        assertEquals(PromotionType.MOBILE_RATE, dto.promotionType());
        assertTrue(dto.enabled()); // entity default = true
        assertNotNull(dto.config()); // entity default = empty HashMap
        assertTrue(dto.config().isEmpty());
        assertEquals(PromotionStatus.PENDING, dto.status());
    }

    @Test
    void record_equalityByValue() {
        ChannelPromotionDto a = new ChannelPromotionDto(
            1L, 1L, ChannelName.AIRBNB, PromotionType.GENIUS, true,
            Map.of(), BigDecimal.ZERO, null, null, PromotionStatus.PENDING,
            null, null, null);
        ChannelPromotionDto b = new ChannelPromotionDto(
            1L, 1L, ChannelName.AIRBNB, PromotionType.GENIUS, true,
            Map.of(), BigDecimal.ZERO, null, null, PromotionStatus.PENDING,
            null, null, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
