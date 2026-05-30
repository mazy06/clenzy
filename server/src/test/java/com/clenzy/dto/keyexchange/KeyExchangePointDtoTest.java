package com.clenzy.dto.keyexchange;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class KeyExchangePointDtoTest {

    @Test
    void defaultConstructor_allFieldsNullAndZeroCount() {
        KeyExchangePointDto dto = new KeyExchangePointDto();

        assertNull(dto.getId());
        assertNull(dto.getPropertyId());
        assertNull(dto.getPropertyName());
        assertNull(dto.getProvider());
        assertNull(dto.getGuardianType());
        assertNull(dto.getProviderStoreId());
        assertNull(dto.getStoreName());
        assertNull(dto.getStoreAddress());
        assertNull(dto.getStorePhone());
        assertNull(dto.getStoreLat());
        assertNull(dto.getStoreLng());
        assertNull(dto.getStoreOpeningHours());
        assertNull(dto.getVerificationToken());
        assertNull(dto.getStatus());
        assertEquals(0L, dto.getActiveCodesCount());
        assertNull(dto.getCreatedAt());
    }

    @Test
    void settersAndGetters_roundtripAllFields() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 30, 14, 30);
        KeyExchangePointDto dto = new KeyExchangePointDto();

        dto.setId(1L);
        dto.setPropertyId(10L);
        dto.setPropertyName("Villa Bleue");
        dto.setProvider("KEYNEST");
        dto.setGuardianType("PARTNER_STORE");
        dto.setProviderStoreId("KN-42");
        dto.setStoreName("Bar du coin");
        dto.setStoreAddress("12 rue Test");
        dto.setStorePhone("+33123456789");
        dto.setStoreLat(48.8566);
        dto.setStoreLng(2.3522);
        dto.setStoreOpeningHours("Mon-Fri 9-18");
        dto.setVerificationToken("tok_abc");
        dto.setStatus("ACTIVE");
        dto.setActiveCodesCount(5L);
        dto.setCreatedAt(now);

        assertEquals(1L, dto.getId());
        assertEquals(10L, dto.getPropertyId());
        assertEquals("Villa Bleue", dto.getPropertyName());
        assertEquals("KEYNEST", dto.getProvider());
        assertEquals("PARTNER_STORE", dto.getGuardianType());
        assertEquals("KN-42", dto.getProviderStoreId());
        assertEquals("Bar du coin", dto.getStoreName());
        assertEquals("12 rue Test", dto.getStoreAddress());
        assertEquals("+33123456789", dto.getStorePhone());
        assertEquals(48.8566, dto.getStoreLat());
        assertEquals(2.3522, dto.getStoreLng());
        assertEquals("Mon-Fri 9-18", dto.getStoreOpeningHours());
        assertEquals("tok_abc", dto.getVerificationToken());
        assertEquals("ACTIVE", dto.getStatus());
        assertEquals(5L, dto.getActiveCodesCount());
        assertEquals(now, dto.getCreatedAt());
    }

    @Test
    void setNull_clearsFields() {
        KeyExchangePointDto dto = new KeyExchangePointDto();
        dto.setId(1L);
        dto.setStoreName("Name");

        dto.setId(null);
        dto.setStoreName(null);

        assertNull(dto.getId());
        assertNull(dto.getStoreName());
    }

    @Test
    void activeCodesCount_acceptsLargeLongValue() {
        KeyExchangePointDto dto = new KeyExchangePointDto();
        dto.setActiveCodesCount(123_456_789L);

        assertEquals(123_456_789L, dto.getActiveCodesCount());
    }

    @Test
    void storeLatLng_acceptsNegativeCoordinates() {
        KeyExchangePointDto dto = new KeyExchangePointDto();
        dto.setStoreLat(-33.8688);
        dto.setStoreLng(-151.2093);

        assertEquals(-33.8688, dto.getStoreLat());
        assertEquals(-151.2093, dto.getStoreLng());
    }
}
