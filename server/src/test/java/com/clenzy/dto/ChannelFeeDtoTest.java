package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelFee;
import com.clenzy.model.ChargeType;
import com.clenzy.model.FeeType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChannelFeeDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        Map<String, Object> config = new HashMap<>();
        config.put("vat", 0.2);
        Instant syncedAt = Instant.parse("2026-05-01T10:00:00Z");
        Instant createdAt = Instant.parse("2026-04-30T09:00:00Z");

        ChannelFeeDto dto = new ChannelFeeDto(
                1L, 10L,
                ChannelName.AIRBNB,
                FeeType.CLEANING,
                "Cleaning fee",
                new BigDecimal("50.00"),
                "EUR",
                ChargeType.PER_STAY,
                true, false, true,
                config,
                "SYNCED",
                syncedAt,
                createdAt
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.propertyId());
        assertEquals(ChannelName.AIRBNB, dto.channelName());
        assertEquals(FeeType.CLEANING, dto.feeType());
        assertEquals("Cleaning fee", dto.name());
        assertEquals(new BigDecimal("50.00"), dto.amount());
        assertEquals("EUR", dto.currency());
        assertEquals(ChargeType.PER_STAY, dto.chargeType());
        assertTrue(dto.isMandatory());
        assertFalse(dto.isTaxable());
        assertTrue(dto.enabled());
        assertEquals(config, dto.config());
        assertEquals("SYNCED", dto.syncStatus());
        assertEquals(syncedAt, dto.syncedAt());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_mapsAllEntityFields() {
        Map<String, Object> config = new HashMap<>();
        config.put("tax", "VAT20");
        Instant syncedAt = Instant.parse("2026-05-10T08:00:00Z");

        ChannelFee fee = new ChannelFee();
        fee.setId(99L);
        fee.setPropertyId(11L);
        fee.setChannelName(ChannelName.BOOKING);
        fee.setFeeType(FeeType.PET);
        fee.setName("Pet fee");
        fee.setAmount(new BigDecimal("20.00"));
        fee.setCurrency("USD");
        fee.setChargeType(ChargeType.PER_NIGHT);
        fee.setIsMandatory(false);
        fee.setIsTaxable(true);
        fee.setEnabled(false);
        fee.setConfig(config);
        fee.setSyncStatus("PENDING");
        fee.setSyncedAt(syncedAt);

        ChannelFeeDto dto = ChannelFeeDto.from(fee);

        assertEquals(99L, dto.id());
        assertEquals(11L, dto.propertyId());
        assertEquals(ChannelName.BOOKING, dto.channelName());
        assertEquals(FeeType.PET, dto.feeType());
        assertEquals("Pet fee", dto.name());
        assertEquals(new BigDecimal("20.00"), dto.amount());
        assertEquals("USD", dto.currency());
        assertEquals(ChargeType.PER_NIGHT, dto.chargeType());
        assertFalse(dto.isMandatory());
        assertTrue(dto.isTaxable());
        assertFalse(dto.enabled());
        assertEquals(config, dto.config());
        assertEquals("PENDING", dto.syncStatus());
        assertEquals(syncedAt, dto.syncedAt());
        assertNull(dto.createdAt());
    }

    @Test
    void from_emptyEntity_returnsDtoWithDefaults() {
        ChannelFee fee = new ChannelFee();

        ChannelFeeDto dto = ChannelFeeDto.from(fee);

        assertNull(dto.id());
        assertEquals("EUR", dto.currency()); // default currency in entity
        assertEquals(ChargeType.PER_STAY, dto.chargeType()); // default in entity
        assertTrue(dto.isMandatory()); // default true
        assertFalse(dto.isTaxable()); // default false
        assertTrue(dto.enabled()); // default true
        assertEquals("PENDING", dto.syncStatus()); // default
    }
}
