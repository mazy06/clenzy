package com.clenzy.integration.channex.dto;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChannexDiscoveredPropertyTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        List<ChannexPropertyOtaSync> otas = List.of(
                new ChannexPropertyOtaSync("Airbnb", true, true),
                new ChannexPropertyOtaSync("BookingCom", false, true)
        );

        ChannexDiscoveredProperty p = new ChannexDiscoveredProperty(
                "cx-uuid-1",
                "Studio Marais",
                "EUR",
                "FR",
                "Europe/Paris",
                4,
                "APARTMENT",
                true,
                true,
                true,
                12,
                true,
                true,
                false,
                null,
                null,
                otas,
                "apartment",
                new BigDecimal("120.00"),
                new BigDecimal("150.00"),
                2,
                new BigDecimal("20.00"),
                0.0,
                16.0,
                2,
                30,
                "14",
                "20",
                11,
                "flexible",
                "everyone",
                Boolean.TRUE,
                Boolean.FALSE,
                Boolean.FALSE
        );

        assertEquals("cx-uuid-1", p.channexPropertyId());
        assertEquals("Studio Marais", p.title());
        assertEquals("EUR", p.currency());
        assertEquals("FR", p.country());
        assertEquals("Europe/Paris", p.timezone());
        assertEquals(4, p.maxOccupancy());
        assertEquals("APARTMENT", p.suggestedType());
        assertTrue(p.hasActiveOta());
        assertTrue(p.hasRoomType());
        assertTrue(p.hasRatePlan());
        assertEquals(12, p.photoCount());
        assertTrue(p.hasDescription());
        assertTrue(p.hasAddress());
        assertFalse(p.isImported());
        assertNull(p.clenzyPropertyId());
        assertNull(p.clenzyPropertyName());
        assertEquals(otas, p.connectedOtas());
        assertEquals("apartment", p.otaListingType());
        assertEquals(new BigDecimal("120.00"), p.otaNightlyPrice());
        assertEquals(new BigDecimal("150.00"), p.otaWeekendPrice());
        assertEquals(2, p.otaGuestsIncluded());
        assertEquals(new BigDecimal("20.00"), p.otaPricePerExtraPerson());
        assertEquals(0.0, p.otaWeeklyPriceFactor());
        assertEquals(16.0, p.otaMonthlyPriceFactor());
        assertEquals(2, p.otaMinNights());
        assertEquals(30, p.otaMaxNights());
        assertEquals("14", p.otaCheckInTimeStart());
        assertEquals("20", p.otaCheckInTimeEnd());
        assertEquals(11, p.otaCheckOutTime());
        assertEquals("flexible", p.otaCancellationPolicy());
        assertEquals("everyone", p.otaInstantBooking());
        assertEquals(Boolean.TRUE, p.otaAllowsPets());
        assertEquals(Boolean.FALSE, p.otaAllowsSmoking());
        assertEquals(Boolean.FALSE, p.otaAllowsEvents());
    }

    @Test
    void canonicalConstructor_acceptsAllNullsForOptionalFields() {
        ChannexDiscoveredProperty p = new ChannexDiscoveredProperty(
                "cx-id",
                "Studio",
                null, null, null, null, null,
                false, false, false,
                0,
                false, false, false,
                null, null,
                List.of(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
        );

        assertEquals("cx-id", p.channexPropertyId());
        assertEquals("Studio", p.title());
        assertNull(p.currency());
        assertNull(p.country());
        assertFalse(p.hasActiveOta());
        assertEquals(0, p.photoCount());
        assertFalse(p.isImported());
        assertTrue(p.connectedOtas().isEmpty());
        assertNull(p.otaAllowsPets());
        assertNull(p.otaAllowsSmoking());
        assertNull(p.otaAllowsEvents());
    }

    @Test
    void imported_propertySetsClenzyFields() {
        ChannexDiscoveredProperty p = new ChannexDiscoveredProperty(
                "cx-id", "Title", "EUR", "FR", "Europe/Paris", 2, "STUDIO",
                true, true, true, 5, true, true,
                true,
                42L,
                "Mon studio",
                List.of(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
        );

        assertTrue(p.isImported());
        assertEquals(42L, p.clenzyPropertyId());
        assertEquals("Mon studio", p.clenzyPropertyName());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        ChannexDiscoveredProperty a = new ChannexDiscoveredProperty(
                "id", "t", null, null, null, null, null,
                false, false, false, 0, false, false, false, null, null,
                List.of(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        ChannexDiscoveredProperty b = new ChannexDiscoveredProperty(
                "id", "t", null, null, null, null, null,
                false, false, false, 0, false, false, false, null, null,
                List.of(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        ChannexDiscoveredProperty c = new ChannexDiscoveredProperty(
                "different", "t", null, null, null, null, null,
                false, false, false, 0, false, false, false, null, null,
                List.of(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void connectedOtas_canHoldMultipleSyncs() {
        List<ChannexPropertyOtaSync> otas = List.of(
                new ChannexPropertyOtaSync("Airbnb", true, true),
                new ChannexPropertyOtaSync("BookingCom", true, true),
                new ChannexPropertyOtaSync("VrboCom", false, false)
        );

        ChannexDiscoveredProperty p = new ChannexDiscoveredProperty(
                "id", "t", "EUR", "FR", "Europe/Paris", 4, "APARTMENT",
                true, true, true, 0, false, false, false, null, null,
                otas,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

        assertEquals(3, p.connectedOtas().size());
        assertEquals("Airbnb", p.connectedOtas().get(0).otaName());
        assertTrue(p.connectedOtas().get(0).isActive());
        assertFalse(p.connectedOtas().get(2).isActive());
    }
}
