package com.clenzy.dto.keyexchange;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class KeyExchangeEventDtoTest {

    @Test
    void defaultConstructor_allFieldsNull() {
        KeyExchangeEventDto dto = new KeyExchangeEventDto();

        assertNull(dto.getId());
        assertNull(dto.getCodeId());
        assertNull(dto.getPointId());
        assertNull(dto.getPointName());
        assertNull(dto.getPropertyId());
        assertNull(dto.getPropertyName());
        assertNull(dto.getEventType());
        assertNull(dto.getActorName());
        assertNull(dto.getNotes());
        assertNull(dto.getSource());
        assertNull(dto.getCreatedAt());
    }

    @Test
    void settersAndGetters_roundtripAllFields() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 30, 12, 0);
        KeyExchangeEventDto dto = new KeyExchangeEventDto();

        dto.setId(1L);
        dto.setCodeId(2L);
        dto.setPointId(3L);
        dto.setPointName("Reception");
        dto.setPropertyId(10L);
        dto.setPropertyName("Villa Bleue");
        dto.setEventType("HANDOVER");
        dto.setActorName("Jean Dupont");
        dto.setNotes("Cle remise main propre");
        dto.setSource("MANUAL");
        dto.setCreatedAt(now);

        assertEquals(1L, dto.getId());
        assertEquals(2L, dto.getCodeId());
        assertEquals(3L, dto.getPointId());
        assertEquals("Reception", dto.getPointName());
        assertEquals(10L, dto.getPropertyId());
        assertEquals("Villa Bleue", dto.getPropertyName());
        assertEquals("HANDOVER", dto.getEventType());
        assertEquals("Jean Dupont", dto.getActorName());
        assertEquals("Cle remise main propre", dto.getNotes());
        assertEquals("MANUAL", dto.getSource());
        assertEquals(now, dto.getCreatedAt());
    }

    @Test
    void setNull_clearsAllFields() {
        KeyExchangeEventDto dto = new KeyExchangeEventDto();
        dto.setId(1L);
        dto.setEventType("X");

        dto.setId(null);
        dto.setEventType(null);

        assertNull(dto.getId());
        assertNull(dto.getEventType());
    }
}
