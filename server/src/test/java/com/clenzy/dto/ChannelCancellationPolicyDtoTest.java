package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChannelCancellationPolicyDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        List<Map<String, Object>> rules = List.of(Map.of("daysBefore", 7, "refundPercent", 100));
        Map<String, Object> config = Map.of("autoRefund", true);
        Instant synced = Instant.parse("2026-05-01T10:00:00Z");
        Instant created = Instant.parse("2026-04-01T10:00:00Z");

        ChannelCancellationPolicyDto dto = new ChannelCancellationPolicyDto(
            5L, 42L, ChannelName.BOOKING, CancellationPolicyType.MODERATE,
            "Moderate policy", "Cancel up to 5 days",
            rules, new BigDecimal("20.00"),
            true, config, "SYNCED", synced, created
        );

        assertEquals(5L, dto.id());
        assertEquals(42L, dto.propertyId());
        assertEquals(ChannelName.BOOKING, dto.channelName());
        assertEquals(CancellationPolicyType.MODERATE, dto.policyType());
        assertEquals("Moderate policy", dto.name());
        assertEquals("Cancel up to 5 days", dto.description());
        assertEquals(rules, dto.cancellationRules());
        assertEquals(new BigDecimal("20.00"), dto.nonRefundableDiscount());
        assertTrue(dto.enabled());
        assertEquals(config, dto.config());
        assertEquals("SYNCED", dto.syncStatus());
        assertEquals(synced, dto.syncedAt());
        assertEquals(created, dto.createdAt());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        List<Map<String, Object>> rules = new ArrayList<>();
        rules.add(Map.of("daysBefore", 14, "refundPercent", 100));

        ChannelCancellationPolicy p = new ChannelCancellationPolicy();
        p.setId(99L);
        p.setPropertyId(11L);
        p.setChannelName(ChannelName.AIRBNB);
        p.setPolicyType(CancellationPolicyType.STRICT);
        p.setName("Strict policy");
        p.setDescription("No refund within 5 days");
        p.setCancellationRules(rules);
        p.setNonRefundableDiscount(new BigDecimal("15.00"));
        p.setEnabled(false);
        p.setConfig(Map.of("key", "value"));
        p.setSyncStatus("FAILED");
        p.setSyncedAt(Instant.parse("2026-06-01T08:00:00Z"));

        ChannelCancellationPolicyDto dto = ChannelCancellationPolicyDto.from(p);

        assertEquals(99L, dto.id());
        assertEquals(11L, dto.propertyId());
        assertEquals(ChannelName.AIRBNB, dto.channelName());
        assertEquals(CancellationPolicyType.STRICT, dto.policyType());
        assertEquals("Strict policy", dto.name());
        assertEquals("No refund within 5 days", dto.description());
        assertEquals(rules, dto.cancellationRules());
        assertEquals(new BigDecimal("15.00"), dto.nonRefundableDiscount());
        assertFalse(dto.enabled());
        assertEquals(Map.of("key", "value"), dto.config());
        assertEquals("FAILED", dto.syncStatus());
        assertEquals(Instant.parse("2026-06-01T08:00:00Z"), dto.syncedAt());
        assertNull(dto.createdAt()); // @PrePersist not invoked outside JPA
    }

    @Test
    void from_minimalEntity_returnsEntityDefaults() {
        ChannelCancellationPolicy p = new ChannelCancellationPolicy();
        p.setPropertyId(1L);
        p.setChannelName(ChannelName.VRBO);
        p.setPolicyType(CancellationPolicyType.FLEXIBLE);

        ChannelCancellationPolicyDto dto = ChannelCancellationPolicyDto.from(p);

        assertEquals(ChannelName.VRBO, dto.channelName());
        assertEquals(CancellationPolicyType.FLEXIBLE, dto.policyType());
        assertTrue(dto.enabled()); // entity default = true
        assertEquals("PENDING", dto.syncStatus()); // entity default
        assertNotNull(dto.cancellationRules()); // empty ArrayList
        assertTrue(dto.cancellationRules().isEmpty());
        assertNotNull(dto.config()); // empty HashMap
        assertTrue(dto.config().isEmpty());
    }

    @Test
    void record_equalityByValue() {
        ChannelCancellationPolicyDto a = new ChannelCancellationPolicyDto(
            1L, 1L, ChannelName.AIRBNB, CancellationPolicyType.FLEXIBLE,
            "n", "d", List.of(), BigDecimal.ZERO, true,
            Map.of(), "PENDING", null, null);
        ChannelCancellationPolicyDto b = new ChannelCancellationPolicyDto(
            1L, 1L, ChannelName.AIRBNB, CancellationPolicyType.FLEXIBLE,
            "n", "d", List.of(), BigDecimal.ZERO, true,
            Map.of(), "PENDING", null, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
